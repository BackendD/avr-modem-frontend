import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AvrModemService } from 'avr-modem';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

  message = 'Testing.. (^_^)';
  inputMessages = '';
  public onReceive: Subscription;
  private inputCount = 0;

  constructor(public avrModemService: AvrModemService) {
  }

  ngOnInit(): void {
    this.onReceive = this.avrModemService.onReceive.subscribe(message => this.inputMessages = `${++this.inputCount}: ${message}`);
  }

  sendMessage(message: string): void {
    this.avrModemService.send(message);
  }

  ngOnDestroy(): void {
    this.onReceive.unsubscribe();
  }
}
