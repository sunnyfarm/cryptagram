// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef BASE_BASE64_H__
#define BASE_BASE64_H__
#pragma once

#include <string>

#include "string_piece.h"

namespace base {

// Encodes the input string in base64.  Returns true if successful and false
// otherwise.  The output string is only modified if successful.
bool Base64Encode(const StringPiece& input, std::string* output);

// Decodes the base64 input string.  Returns true if successful and false
// otherwise.  The output string is only modified if successful.
bool Base64Decode(const StringPiece& input, std::string* output);

std::string Base64Encode(const StringPiece& input);
std::string Base64Decode(const StringPiece& input);

}  // namespace base

#endif  // BASE_BASE64_H__
