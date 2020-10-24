import { Component, OnInit } from '@angular/core';
import { AvrModemService } from 'avr-modem';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  message = '';

  constructor(private avrModemService: AvrModemService) {
  }

  ngOnInit(): void {
  }

  sendMessage(message: string): void {
    this.avrModemService.send(message);
  }
}
