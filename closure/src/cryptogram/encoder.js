goog.provide('cryptogram.encoder');


/**
 * @constructor
 */
cryptogram.encoder = function() {};


cryptogram.encoder.octal_symbol_thresholds = [238, 210, 182, 154, 126, 98, 70, 42, 14];

// Each base-64 character gets split into two octal symbols, so we have one
// function to turn an octal symbol into a single threshold and a base-64
// character into a short array of thresholds.
cryptogram.encoder.base64_values = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

cryptogram.encoder.prototype.encrypt = function(data, password) {

  // Get rid of data type information (for now assuming always JPEG.
  var withoutMimeHeader = data.split('base64,')[1];

  var encrypted_data = JSON.parse(sjcl.encrypt(password, withoutMimeHeader));
  var iv = encrypted_data['iv'];
  var salt = encrypted_data['salt'];
  var ct = encrypted_data['ct'];
  var to_hash = iv + salt + ct;

	var bits = sjcl.hash.sha256.hash(to_hash);
  var integrity_check_value = sjcl.codec.hex.fromBits(bits);
  return integrity_check_value + to_hash;
};


cryptogram.encoder.prototype.encode = function(data, width_to_height_ratio, header_string, block_width,
								block_height) {

  width_to_height_ratio = typeof width_to_height_ratio !== 'undefined' ?
		width_to_height_ratio : 1.0;
  header_string = typeof header_string !== 'undefined' ? header_string :
		'aesthete';
  block_width = typeof block_width !== 'undefined' ? block_width : 2;
  block_height = typeof block_height !== 'undefined' ? block_height : 2;

  n_header_symbols = header_string.length;

  // grow an array of grayscale values and then convert them to an RGB Image
  // afterward (so we don't have to precompute size or worry about the header
  // yet
  function add_char(ch,values) {
    var value = cryptogram.encoder.base64_values.indexOf(ch);
    var x = Math.floor(value / 8);
    var y = value % 8;
    values.push(x);
    values.push(y);
  }

  // first translate the header string
  var header_values = new Array();
  for (var i = 0; i < header_string.length; i++) {
    add_char(header_string[i], header_values);
  }

  // next translate the image data
  var values = new Array();
  for (var i = 0; i < data.length; i++) {
    add_char(data[i], values);
  }

  // how many octal values did we get from the header string?
  var n_header_values = header_values.length;
  var n_header_values_in_row = Math.ceil(Math.sqrt(n_header_values));

  // always encode an even number of octal values in a row, don't split a base64
  // character over two rows
  if (n_header_values_in_row % 2 != 0) { n_header_values_in_row++; }
  var header_width = n_header_values_in_row * block_width;
  var header_height = n_header_values_in_row * block_height;
  var n_pixels_in_header = header_width * header_height;

  // how many octal values do we have from our actual image data?
  var n_values = values.length;
  var block_size = block_width * block_height;
  var n_pixels = block_size * n_values + n_pixels_in_header;
  var height = Math.sqrt(n_pixels / width_to_height_ratio);
  var width = Math.ceil(width_to_height_ratio * height);

  // make output height a multiple of block height
  height = Math.ceil(Math.ceil(height) / block_height) * block_height;

  // make output width a multiple of twice block width, so that two octal values
  // always encoded on same line
  width = Math.ceil(width / (2* block_width)) * 2 *  block_width;
  var c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  var cxt = c.getContext('2d');
  
  var imageData = cxt.createImageData(width, height);
  var d = imageData.data;

  function set_pixel(x, y, r, g, b) {
    idx = 4 * (x + y * width);
 
    // set RGB channels to same level since we're encoding data as grayscale
    d[idx] = r;
    d[idx + 1] = g;
    d[idx + 2] = b;
    d[idx + 3] = 255; // alpha channel
  }

  function set_block(x_start, y_start, level) {
   var r = level;
   var b = level;
   var g = level;
   
   /* var max = 255 - level;
    
    if (level > 128) {
      b = level + max;
      r  = level -  ((.114 / .299) * max);
      var Y = 0.299 * r + 0.587 * level + 0.114 * b;
    
      if (x_start == y_start) {
        console.log(x_start + " >> "+ Y +": (" + r + "," + level + "," + b + ")");
      }
    }*/
    
    var stripeX = Math.floor(x_start / 16) % 3;
    var stripeY = Math.floor(y_start / 16) % 3;
    
    if (stripeX == 0) {
      r = level + 25;
    } else if (stripeX == 1) {
      r = level - 25;
    }
    
    
    /*if (stripeY == 0) {
      b = level + 25;
    } else if (stripeY == 1) {
      b = level - 25;
    }
    
       
   
    for (var i = 0; i < block_width; i++) {
      for (var j = 0; j < block_height; j++) {
        set_pixel(x_start+i, y_start+j, r, g, b);
      }
    }
  }
  var pix_idx = 0;
  var value_idx;
  var level;

  // fill the header pixels
  for (var y = 0; y < header_height; y += block_height) {
    for (var x = 0; x < header_width; x += block_width) {
      value_idx = x / block_width + (y  / block_height) *
				(header_width / block_width);
			level = 8;
      if (value_idx < n_header_values) {
        level =  cryptogram.encoder.octal_symbol_thresholds[header_values[value_idx]];
      }
      set_block(x, y, level);
    }
  }

  n_header_row_symbols_wide = (width - header_width) / block_width;
  n_header_row_symbols = n_header_row_symbols_wide *
		(header_height / block_height)
  n_symbols_in_full_row = width / block_width;
  var x_coord, y_coord, x, y, i2;
  for (var i = 0; i < n_values; i++) {
    octal = values[i];
    level = cryptogram.encoder.octal_symbol_thresholds[octal];
    if (i < n_header_row_symbols) {
      y_coord = Math.floor(i / n_header_row_symbols_wide);
      x_coord = (i - (y_coord * n_header_row_symbols_wide));
      x = header_width + (x_coord * block_width);
    } else {
     i2 = i + n_header_values;
     y_coord = Math.floor(i2 / n_symbols_in_full_row);
     x_coord = i2 - (y_coord * n_symbols_in_full_row);
     x = x_coord * block_width;
    }
    y = y_coord * block_height;
    set_block(x,y,level);
  }
    
  cxt.putImageData(imageData, 0, 0);
  var img = new Image();
  img.src = c.toDataURL('image/jpeg', 0.74);
  return img;
};


cryptogram.encoder.show_error = function(msg, url, linenumber) {
  console.log('Error message: '+msg+'\nURL: '+url+'\nLine Number: '+linenumber)
  return true;
};