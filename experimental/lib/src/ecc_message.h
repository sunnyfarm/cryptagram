// Copyright 2012. The Cryptogram Authors. BSD Style License.
// Author: tierney@cs.nyu.edu (Matt Tierney)

#ifndef _ECC_MESSAGE_H_
#define _ECC_MESSAGE_H_

#include <stddef.h>
#include <stdint.h>

#include "ecc_image.h"
#include "reed_solomon/rs_codec.h"
#include "reentrant_rand.h"

namespace cryptogram {

// We will be given a sequence of 223 randomly-generated bytes. The bytes will
// then be ECC'd to produce a parity sequence of bytes. This produce is executed
// twice. These 510 bytes are concatenated. The result is then embedded into an
// array that is the JPEG'd. The JPEG is decompressed and decoded to two total
// transmissions, which each are 255 bytes (223 message byte and 32 parity
// bytes). We must compare the sequence of bytes.
class EccMessage {
 public:
  enum Position {
    FIRST = 0,
    SECOND,
  };

  EccMessage();
  virtual ~EccMessage();

  void Reset();

  void InitWithRandomData();
  
  void SetMessage(uint8_t *message, Position pos);

  void SetParity(uint16_t *parity, Position pos);

  void FillWithRandomData(uint8_t *data, size_t len);

  unsigned char *flatten();

  // Some useful getters.
  unsigned char *bytes() { return bytes_; }

  uint8_t *first_message() { return first_message_; }
  uint16_t *first_parity() { return first_parity_; }

  uint8_t *second_message() { return second_message_; }
  uint16_t *second_parity() { return second_parity_; }

 private:
  ReentrantRNG prng_;
  
  unsigned char bytes_[2 * kRs255_223TotalBytes];

  uint8_t first_message_[kRs255_223MessageBytes];
  uint16_t first_parity_[kParityArraySize];
  uint8_t second_message_[kRs255_223MessageBytes];
  uint16_t second_parity_[kParityArraySize];
};

} // namespace cryptogram

#endif  // _ECC_MESSAGE_H_
