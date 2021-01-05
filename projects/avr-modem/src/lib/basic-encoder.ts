// tslint:disable:no-bitwise

import { Encoder } from './encoder';
import { utf8Encode } from '@angular/compiler/src/util';
import { Profile } from './profile';
import { Package, PackageCmd } from './package';

export class BasicEncoder implements Encoder {

  private prof: Profile; // profile
  private smplRate: number;

  private samplesPerBit: number;
  private bitBufferLow: Float32Array;
  private bitBufferHigh: Float32Array;

  constructor(profile: Profile, sampleRate: number) {
    this.prof = profile;
    this.smplRate = sampleRate;
    this.reset();
  }

  set profile(profile: Profile) {
    this.prof = profile;
    this.reset();
  }

  get profile(): Profile {
    return this.prof;
  }

  set sampleRate(sampleRate: number) {
    this.smplRate = sampleRate;
    this.reset();
  }

  get sampleRate(): number {
    return this.smplRate;
  }

  private reset(): void {
    this.samplesPerBit = Math.round(this.sampleRate / this.profile.baud);
    this.bitBufferLow = new Float32Array(this.samplesPerBit);
    this.bitBufferHigh = new Float32Array(this.samplesPerBit);

    const phaseIncLow = 2 * Math.PI * this.profile.freqLow / this.sampleRate;
    const phaseIncHigh = 2 * Math.PI * this.profile.freqHigh / this.sampleRate;

    for (let bitBufferIndex = 0; bitBufferIndex < this.samplesPerBit; bitBufferIndex++) {
      this.bitBufferLow[bitBufferIndex] = Math.cos(phaseIncLow * bitBufferIndex);
      this.bitBufferHigh[bitBufferIndex] = Math.cos(phaseIncHigh * bitBufferIndex);
    }
  }

  mkMsgPkg(msg: string): Package {
    const pkgSectBitLength = 12;
    msg = utf8Encode(msg);
    const streamSize = (1 + msg.length) * pkgSectBitLength * this.samplesPerBit;
    const stream: Float32Array = new Float32Array(streamSize);

    let msgStreamIndex = 0;

    const pushByte = (byte: number, ctrlBit: boolean) => {
      byte &= 0xFF;
      let byteHldr = byte;                          // character bits        0000 0000 xxxx xxxx
      byteHldr <<= 1;                               // start bit             0000 000x xxxx xxx0
      byteHldr |= 0x800;                            // stop bit              0000 100x xxxx xxx0
      byteHldr |= ctrlBit ? 0x200 : 0x400;          // control & parity bit  0000 1pcx xxxx xxx0
      do {
        if (byte & 1) {
          byteHldr ^= 0x400;
        }
      } while (Boolean(byte >>= 1));          // parity bit(even = 0)  0000 1pcx xxxx xxx0

      do {
        stream.set(byteHldr & 1 ? this.bitBufferHigh : this.bitBufferLow, msgStreamIndex);
        msgStreamIndex += this.samplesPerBit;
      } while (Boolean(byteHldr >>= 1));
    };

    pushByte((msg.length << 4) | PackageCmd.MESSAGE, true);

    for (const char of msg) {
      pushByte(char.charCodeAt(0), false);    // Message Characters
    }

    const pkg = {cmd: PackageCmd.MESSAGE, message: null, size: msg.length, messageStream: stream};
    return pkg;
  }

  modulate(message: string): Float32Array {

    message = utf8Encode(message);
    // setting 0 at the end of the message
    message += String.fromCharCode(0);
    const bufferLength = message.length * 11 * this.samplesPerBit;
    const samples: Float32Array = new Float32Array(bufferLength);

    let samplesHead = 0;

    for (const character of message) {

      let data: number = character.charCodeAt(0);

      let parityBit = true;
      let bit = 0x100;                        // 1 0000 0000
      while (Boolean(bit >>= 1)) {
        parityBit = bit & data ? !parityBit : parityBit;
      }

      data <<= 1;                          // (start bit): data in binary is --- ---- ---0
      data |= parityBit ? 0x200 : 0;       // (parityBit): data in binary is -x- ---- ---0
      data |= 0x400;                       // (stop bit):  data in binary is 1x- ---- ---0

      // fill the samples with the right amounts
      for (let bitIndex = 0; bitIndex < 11; bitIndex++, data >>= 1, samplesHead += this.samplesPerBit) {
        samples.set(data & 1 ? this.bitBufferHigh : this.bitBufferLow, samplesHead);
      }
    }
    return samples;
  }
}
