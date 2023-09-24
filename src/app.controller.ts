import { Controller, Get } from '@nestjs/common';

@Controller('/')
export class AppController {
  @Get('/')
  serverOn() {
    return 'Server is Open';
  }
}
