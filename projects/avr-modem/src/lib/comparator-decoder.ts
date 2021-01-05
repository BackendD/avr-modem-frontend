// tslint:disable:no-bitwise

import { Decoder } from './decoder';
import { Profile } from './profile';
import { Subject } from 'rxjs';
import { Package, PackageCmd } from './package';

export class ComparatorDecoder implements Decoder {

  private prof: Profile; // profile
  private smplRate: number;

  onReceive: Subject<Package> = new Subject<Package>();

  private lastSampleOnTop = true;

  private smplsPerBd = 0;
  private smplsPerFreqCnt = 0;
  private smplsPerBdCnt = 0;
  private smplsPerBdCntLow = 0;
  private smplsPerBdCntHigh = 0;

  private minSamplesPerLowFreq = 0;
  private maxSamplesPerLowFreq = 0;
  private minSamplesPerHighFreq = 0;
  private maxSamplesPerHighFreq = 0;

  private rcvStat: ReceiveStatus = ReceiveStatus.INACTIVE;
  private rcvBits = 0;
  private parityBit: boolean;
  private ctrlBit: boolean;

  private pkg: Package;
  private pkgStat: PackageStatus = PackageStatus.INACTIVE;

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
    this.smplsPerBd = this.sampleRate / this.profile.baud;
    const samplesPerLowFreq = this.sampleRate / this.profile.freqLow;
    const samplesPerHighFreq = this.sampleRate / this.profile.freqHigh;
    const highPerLow = this.profile.freqLow / this.profile.freqHigh;

    const rSamplesPerLowFreq = (samplesPerLowFreq - samplesPerHighFreq) * (highPerLow);
    const rSamplesPerHighFreq = (samplesPerLowFreq - samplesPerHighFreq) * (1 - highPerLow);

    this.minSamplesPerLowFreq = samplesPerLowFreq - rSamplesPerLowFreq;
    this.maxSamplesPerLowFreq = samplesPerLowFreq + rSamplesPerLowFreq;
    this.minSamplesPerHighFreq = samplesPerHighFreq - rSamplesPerHighFreq;
    this.maxSamplesPerHighFreq = samplesPerHighFreq + rSamplesPerHighFreq;
  }

  demod(samples: Float32Array): void {

    for (const sample of samples) {

      // comparator call on falling edge
      if (this.lastSampleOnTop && sample < 0) {
        this.compare();
      }

      // baud complete call on every baud if receive status wasn't INACTIVE
      if (this.rcvStat < ReceiveStatus.INACTIVE && this.smplsPerBdCnt > this.smplsPerBd) {
        this.onBdCpl();
        this.smplsPerBdCnt = 0;
      }

      this.lastSampleOnTop = (sample >= 0);
      this.smplsPerFreqCnt++;
      this.smplsPerBdCnt++;
    }
  }

  private compare(): void {
    const sampleCounter = this.smplsPerFreqCnt;

    // wave is too short
    if (sampleCounter < this.minSamplesPerHighFreq) {
      return;
    }

    this.smplsPerFreqCnt = 0;
    // wave is too long
    if (sampleCounter > this.maxSamplesPerLowFreq) {
      this.smplsPerBdCntLow = this.smplsPerBdCntHigh = 0;
      this.rcvStat = ReceiveStatus.INACTIVE;
      return;
    }

    // zero's wave
    if (sampleCounter > this.minSamplesPerLowFreq) {
      this.smplsPerBdCntLow += sampleCounter;

      if (this.rcvStat === ReceiveStatus.INACTIVE) {
        // start bit detection
        if (this.smplsPerBdCntLow > this.smplsPerBd * 0.50) {
          this.rcvStat = ReceiveStatus.START_BIT;
          this.smplsPerBdCntHigh = 0;
          this.smplsPerBdCnt = this.smplsPerBdCntLow;
        }
      }
    }
    // one's wave
    else {
      if (this.rcvStat === ReceiveStatus.INACTIVE) {
        this.smplsPerBdCntLow = this.smplsPerBdCntHigh = 0;
      } else {
        this.smplsPerBdCntHigh += sampleCounter;
      }
    }
  }

  private onBdCpl(): void {

    // Bit logic determination
    const high = this.smplsPerBdCntHigh < this.smplsPerBdCntLow ? 0x00 : 0x80;

    this.smplsPerBdCntLow = 0;
    this.smplsPerBdCntHigh = 0;

    // start bit reception
    if (this.rcvStat === ReceiveStatus.START_BIT && high === 0) {
      this.rcvBits = 0;
      this.parityBit = false;
      this.rcvStat++;
      return;
    }
    // data bit reception
    if (this.rcvStat <= ReceiveStatus.DATA_BIT) {
      this.rcvBits >>>= 1;
      this.rcvBits |= high;
      this.parityBit = high ? !this.parityBit : this.parityBit;
      this.rcvStat++;
      return;
    }
    // control bit reception
    if (this.rcvStat === ReceiveStatus.CONTROL_BIT) {
      this.ctrlBit = Boolean(high);
      this.parityBit = high ? !this.parityBit : this.parityBit;
      this.rcvStat++;
      return;
    }
    // parity bit reception
    if (this.rcvStat === ReceiveStatus.PARITY_BIT) {
      if (Boolean(high) === this.parityBit) {
        this.rcvStat++;
        return;
      }
    }
    // stop bit reception
    if (this.rcvStat === ReceiveStatus.STOP_BIT) {
      if (high === 0x80) {
        this.onRcvByte(this.rcvBits, this.ctrlBit);
      }
    }
    this.rcvStat = ReceiveStatus.INACTIVE;
  }

  private onRcvByte(byte: number, controlBit: boolean): void {

    if (controlBit) {
      this.pkgStat = PackageStatus.HEADER;
      this.pkg = {cmd: 0, message: '', size: 0, messageStream: null};
      this.pkg.cmd = byte & 0x0F;
      if (this.pkg.cmd === PackageCmd.MESSAGE) {
        this.pkg.size = byte >> 4;
        if (this.pkg.size) {
          this.pkgStat = PackageStatus.MESSAGE;
          return;
        }
        this.pkgStat = PackageStatus.END_OF_RX;
      }
    }

    if (this.pkgStat === PackageStatus.MESSAGE) {
      this.pkg.message += String.fromCharCode(byte);
      if (this.pkg.message.length === this.pkg.size) {
        this.pkgStat = PackageStatus.END_OF_RX;
      } else {
        return;
      }
    }

    if (this.pkgStat === PackageStatus.END_OF_RX) {
      if (this.pkg.message.length === this.pkg.size) {
        this.onReceive.next(this.pkg);
      }
    }

    this.pkgStat = PackageStatus.INACTIVE;
  }

}

enum ReceiveStatus {
  START_BIT = 0,
  DATA_BIT = 8,
  CONTROL_BIT = 9,
  PARITY_BIT = 10,
  STOP_BIT = 11,
  INACTIVE = 0xFF
}

enum PackageStatus {
  HEADER = 0,
  MESSAGE = 1,
  END_OF_RX = 2,
  INACTIVE = 0xFF
}
