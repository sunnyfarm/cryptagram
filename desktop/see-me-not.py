#!/usr/bin/env python

# TODO(tierney): Last row repair. Instead of writing black, we probably want to
# write an average of the preceeding rows in the block of 8 (due to the JPEG
# DCT). Of course, we must find a way to reengineer this application. Notably,
# the last row will be unrecoverable especially if resizing is involved.

import base64
import sys
import logging
import os
from tempfile import NamedTemporaryFile
from Cipher import V8Cipher as Cipher
from json import JSONEncoder, JSONDecoder

from Encryptor import Encrypt
from SymbolShape import SymbolShape, four_square, three_square, two_square, \
    one_square, two_by_four, two_by_three, two_by_one
from Codec import Codec
from PIL import Image
from ImageCoder import Base64MessageSymbolCoder, Base64SymbolSignalCoder
import gflags

logging.basicConfig(stream=sys.stdout, level=logging.INFO,
                    format = '%(asctime)-15s %(levelname)8s %(module)10s '\
                      '%(threadName)10s %(thread)16d %(lineno)4d %(message)s')

FLAGS = gflags.FLAGS
gflags.DEFINE_integer('quality', 95,
                      'quality to save encrypted image in range (0,95]. ',
                      short_name = 'q')
gflags.DEFINE_string('password', None, 'Password to encrypt image with.',
                     short_name = 'p')
gflags.DEFINE_string('symbol_shape', 'two_square', 'symbol shape to use',
                     short_name ='s')
gflags.DEFINE_string('image', None, 'path to input image', short_name = 'i')
gflags.DEFINE_string('encrypt', None, 'encrypted image output filename',
                     short_name = 'e')
gflags.DEFINE_string('decrypt', None, 'decrypted image output filename',
                      short_name = 'd')

gflags.MarkFlagAsRequired('password')

_AVAILABLE_SHAPES = {
  'four_square' : four_square,
  'three_square': three_square,
  'two_square' : two_square,
  'one_square' : one_square,
  'two_by_four' : two_by_four,
  'two_by_three' : two_by_three,
  'two_by_one' : two_by_one,
}

def main(argv):
  try:
    argv = FLAGS(argv)  # parse flags
  except gflags.FlagsError, e:
    print '%s\nUsage: %s ARGS\n%s' % (e, sys.argv[0], FLAGS)
    sys.exit(1)

  symbol_shape = _AVAILABLE_SHAPES[FLAGS.symbol_shape]
  quality = FLAGS.quality
  cipher = Cipher(FLAGS.password)

  if FLAGS.image and FLAGS.encrypt:
    logging.info('Image to encrypt: %s.' % FLAGS.image)

    # Update codec based on wh_ratio from given image.
    _image = Image.open(FLAGS.image)
    _width, _height = _image.size
    wh_ratio = _width / float(_height)
    codec = Codec(symbol_shape, wh_ratio, Base64MessageSymbolCoder(),
                  Base64SymbolSignalCoder())

    # Determine file size.
    with open(FLAGS.image,'rb') as fh:
      orig_data = fh.read()
      length = fh.tell()
      logging.info('Image filesize: %d bytes.' % length)

    crypto = Encrypt(FLAGS.image, codec, cipher)
    encrypted_data = crypto.upload_encrypt()
    logging.info('Encrypted data length: %d.' % len(encrypted_data))
    im = codec.encode(encrypted_data)

    logging.info('Saving encrypted jpeg with quality %d.' % quality)
    with open(FLAGS.encrypt, 'w') as out_file:
      im.save(out_file, quality=quality)

    with open(FLAGS.encrypt) as fh:
      fh.read()
      logging.info('Encrypted image size: %d bytes.' % fh.tell())
      logging.info('Encrypted image data expansion %.2f.' % \
                     (fh.tell() / float(length)))

  if not FLAGS.decrypt:
    return

  if FLAGS.image and FLAGS.encrypt and FLAGS.decrypt:
    read_back_image = Image.open(FLAGS.encrypt)
  elif FLAGS.image and not FLAGS.encrypt and FLAGS.decrypt:
    logging.info('Reading message we did not encrypt.')
    with open(FLAGS.image, 'rb') as fh:
      fh.read()
      logging.info('Encrypted image filesize: %d.' % fh.tell())

    read_back_image = Image.open(FLAGS.image)
    _width, _height = read_back_image.size
    wh_ratio = _width / float(_height)
    codec = Codec(symbol_shape, wh_ratio, Base64MessageSymbolCoder(),
                  Base64SymbolSignalCoder())

  binary_decoding = codec.decode(read_back_image)

  if FLAGS.encrypt and FLAGS.decrypt:
    logging.info('Byte for byte diff: %d.' % \
                   byte_for_byte_compare(encrypted_data, binary_decoding))

  # Required "un"-filtering to base64 data.
  def _base64_pad(s):
    mod = len(s) % 4
    if mod == 0: return s
    return s + (4 - mod) * '='

  # padded_decoding = _base64_pad(binary_decoding)
  _pad = 3

  _iv = binary_decoding[0:22]
  _salt = binary_decoding[22:33]
  _ct = binary_decoding[33:]
  decoded = {'iv': _iv, 'salt': _salt, 'ct': _ct}
  json_str = JSONEncoder().encode(decoded)

  decrypted_decoded = cipher.decode(json_str)
  # with open('decrypted.base64.txt', 'w') as fh:
  #   fh.write(decrypted_decoded)
  extracted_data = base64.b64decode(decrypted_decoded)

  if FLAGS.image and FLAGS.decrypt:
    with open(FLAGS.decrypt, 'wb') as fh:
      fh.write(extracted_data)
    logging.info('Saved decrypted file: %s.' % FLAGS.decrypt)


def byte_for_byte_compare(a, b):
  errors = 0
  for i, datum in enumerate(a[:min(len(a), len(b))]):
    if datum != b[i]:
      errors += 1
  if len(b) > len(a):
    errors += len(b) - len(a)
  return errors

if __name__=='__main__':
  main(sys.argv)