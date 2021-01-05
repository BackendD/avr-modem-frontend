import { Inject, Injectable, Optional } from '@angular/core';
import { Encoder } from './encoder';
import { Profile } from './profile';
import { Decoder } from './decoder';
import { BasicEncoder } from './basic-encoder';
import { ComparatorDecoder } from './comparator-decoder';
import { Subject, Subscription } from 'rxjs';
import { Package, PackageCmd } from './package';

@Injectable({
  providedIn: 'root'
})
export class AvrModemService {

  onReceive: Subject<string> = new Subject<string>();

  private prof: Profile; // profile
  private ncoder: Encoder; // encoder
  private dcoder: Decoder; // decoder
  private decoderSub: Subscription;

  private seq = 0;
  private mediaStream: MediaStream;
  private listening = false;

  constructor(
    @Inject('audioContext') @Optional() public audioContext: AudioContext,
    @Inject('avrModemProfile') @Optional() profile: Profile,
    @Inject('avrModemEncoder') @Optional() encoder: Encoder,
    @Inject('avrModemDecoder') @Optional() decoder: Decoder) {

    this.audioContext = audioContext || new AudioContext();
    this.prof = profile || {baud: 1600, freqLow: 4800, freqHigh: 8000};
    this.ncoder = encoder || new BasicEncoder(this.profile, this.audioContext.sampleRate);
    this.dcoder = decoder || new ComparatorDecoder(this.profile, this.audioContext.sampleRate);
    this.decoderSub = this.dcoder.onReceive.subscribe(pkg => this.pkgRouter(pkg));
  }

  set profile(profile: Profile) {
    this.prof = profile;
    this.encoder.profile = profile;
    this.decoder.profile = profile;
  }

  get profile(): Profile {
    return this.prof;
  }

  set encoder(encoder: Encoder) {
    encoder.profile = this.profile;
    encoder.sampleRate = this.audioContext.sampleRate;
    this.ncoder = encoder;
  }

  get encoder(): Encoder {
    return this.ncoder;
  }

  set decoder(decoder: Decoder) {
    decoder.profile = this.profile;
    decoder.sampleRate = this.audioContext.sampleRate;
    this.decoderSub.unsubscribe();
    this.decoderSub = decoder.onReceive.subscribe(pkg => this.onReceive.next(pkg.message));
    this.dcoder = decoder;
  }

  get decoder(): Decoder {
    return this.dcoder;
  }

  send(message: string): void {
    const pkg: Package = this.encoder.mkMsgPkg(message);
    const samples: Float32Array = pkg.messageStream;
    const audioBuffer: AudioBuffer = this.audioContext.createBuffer(1, samples.length, this.audioContext.sampleRate);
    audioBuffer.getChannelData(0).set(samples);
    const audioBufferSourceNode: AudioBufferSourceNode = this.audioContext.createBufferSource();
    audioBufferSourceNode.buffer = audioBuffer;
    audioBufferSourceNode.connect(this.audioContext.destination);

    audioBufferSourceNode.start(0);
  }

  set listen(value: boolean) {
    if (value === this.listen) {
      return;
    }

    if (value) {
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false
        },
        video: false
      }).then(mediaStream => this.onAudioAccessPermit(mediaStream))
        .catch(() => console.warn('Audio Access Denied..'));
    } else {
      this.mediaStream.getTracks().forEach(mediaStreamTrack => mediaStreamTrack.enabled = false);
      this.listening = value;
    }
  }

  get listen(): boolean {
    return this.listening;
  }

  private onAudioAccessPermit(mediaStream: MediaStream): void {
    this.mediaStream = mediaStream;
    const mediaStreamAudioSourceNode: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);
    const scriptProcessorNode: ScriptProcessorNode = this.audioContext.createScriptProcessor(8192, 1, 1);
    mediaStreamAudioSourceNode.connect(scriptProcessorNode);
    scriptProcessorNode.addEventListener('audioprocess', audioProcessingEvent => this.onAudioProcess(audioProcessingEvent));
    scriptProcessorNode.disconnect();
    this.listening = true;
  }

  private onAudioProcess(audioProcessingEvent: AudioProcessingEvent): void {
    const samples: Float32Array = audioProcessingEvent.inputBuffer.getChannelData(0);
    const message = this.decoder.demod(samples);
  }

  private pkgRouter(pkg: Package): void {
    if (pkg.cmd === PackageCmd.MESSAGE) {
      this.onReceive.next(pkg.message);
    }
  }
}
