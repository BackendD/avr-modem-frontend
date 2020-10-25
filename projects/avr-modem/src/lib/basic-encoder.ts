// tslint:disable:no-bitwise

import { AvrModemEncoder } from './avr-modem-encoder';
import { utf8Encode } from '@angular/compiler/src/util';
import { AvrModemProfile } from './avr-modem-profile';

export class BasicEncoder implements AvrModemEncoder {

  private prof: AvrModemProfile; // profile
  private smplRate: number;

  private samplesPerBit: number;
  private bitBufferLow: Float32Array;
  private bitBufferHigh: Float32Array;

  constructor(profile: AvrModemProfile, sampleRate: number) {
    this.prof = profile;
    this.smplRate = sampleRate;
    this.reset();
  }

  set profile(profile: AvrModemProfile) {
    this.prof = profile;
    this.reset();
  }

  get profile(): AvrModemProfile {
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

  modulate(message: string): Float32Array {

    message = utf8Encode(message);
    const bufferLength = message.length * 10 * this.samplesPerBit;
    const samples: Float32Array = new Float32Array(bufferLength);

    let samplesHead = 0;

    for (const character of message) {

      let data: number = character.charCodeAt(0);
      data <<= 1;                      // (start bit) data in binary is  - ---- ---0
      data |= 0x200;                   // (stop bit)  data in binary is 1- ---- ---0

      // fill the samples with the right amounts
      for (let bitIndex = 0; bitIndex < 10; bitIndex++, data >>= 1, samplesHead += this.samplesPerBit) {
        samples.set(data & 1 ? this.bitBufferHigh : this.bitBufferLow, samplesHead);
      }
    }
    return samples;
  }
}
