import { Inject, Injectable, Optional } from '@angular/core';
import { AvrModemEncoder } from './avr-modem-encoder';
import { AvrModemProfile } from './avr-modem-profile';
import { AvrModemDecoder } from './avr-modem-decoder';
import { BasicEncoder } from './basic-encoder';
import { ComparatorDecoder } from './comparator-decoder';

@Injectable({
  providedIn: 'root'
})
export class AvrModemService {

  private prof: AvrModemProfile; // profile
  private ncdr: AvrModemEncoder; // encoder
  private dcdr: AvrModemDecoder; // decoder

  constructor(
    @Inject('audioContext') @Optional() public audioContext: AudioContext,
    @Inject('avrModemProfile') @Optional() profile: AvrModemProfile,
    @Inject('avrModemEncoder') @Optional() encoder: AvrModemEncoder,
    @Inject('avrModemDecoder') @Optional() decoder: AvrModemDecoder) {

    this.audioContext = audioContext || new AudioContext();
    this.prof = profile || {baud: 1225, freqLow: 4900, freqHigh: 7350};
    this.ncdr = encoder || new BasicEncoder(this.profile, this.audioContext.sampleRate);
    this.dcdr = decoder || new ComparatorDecoder();
  }

  set profile(profile: AvrModemProfile) {
    this.prof = profile;
    this.encoder.profile = profile;
  }

  get profile(): AvrModemProfile {
    return this.prof;
  }

  set encoder(encoder: AvrModemEncoder) {
    encoder.profile = this.profile;
    encoder.sampleRate = this.audioContext.sampleRate;
    this.ncdr = encoder;
  }

  get encoder(): AvrModemEncoder {
    return this.ncdr;
  }

  send(message: string): void {
    if (!message) {
      return;
    }
    // encode message
    const samples: Float32Array = this.encoder.modulate(message);
    // create an audio buffer
    const audioBuffer: AudioBuffer = this.audioContext.createBuffer(1, samples.length, this.audioContext.sampleRate);
    // copy encoded message into the audio buffer
    audioBuffer.getChannelData(0).set(samples);
    // create a buffer source
    const audioBufferSourceNode: AudioBufferSourceNode = this.audioContext.createBufferSource();
    // attach audio buffer to buffer source
    audioBufferSourceNode.buffer = audioBuffer;
    // connect buffer source to speaker
    audioBufferSourceNode.connect(this.audioContext.destination);
    // play (send encoded message)
    audioBufferSourceNode.start(0);
  }
}
