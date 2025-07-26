import { HttpException, HttpStatus } from '@nestjs/common';

export class TelegramAuthException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.UNAUTHORIZED) {
    super(message, status);
  }
}

export class UserRegistrationException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class InvalidTelegramDataException extends HttpException {
  constructor(message: string = 'Invalid Telegram user data') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
