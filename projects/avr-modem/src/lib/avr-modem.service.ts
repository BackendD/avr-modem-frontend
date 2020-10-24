import { Inject, Injectable, Optional } from '@angular/core';
import { AvrModemEncoder } from './avr-modem-encoder';
import { AvrModemProfile } from './avr-modem-profile';
import { BasicEncoder } from './basic-encoder';
import { AvrModemDecoder } from './avr-modem-decoder';
import { ComparatorDecoder } from './comparator-decoder';

@Injectable({
  providedIn: 'root'
})
export class AvrModemService {

  constructor(
    @Inject('audioContext') @Optional() private audioContext: AudioContext,
    @Inject('avrModemProfile') @Optional() private profile: AvrModemProfile,
    @Inject('avrModemEncoder') @Optional() private encoder: AvrModemEncoder,
    @Inject('avrModemDecoder') @Optional() private decoder: AvrModemDecoder) {

    this.audioContext = audioContext || new AudioContext();
    this.profile = profile || {baud: 1225, freqLow: 4900, freqHigh: 7350};
    this.encoder = encoder || new BasicEncoder();
    this.decoder = decoder || new ComparatorDecoder();
  }

  send(message: string): void {
  }
}
