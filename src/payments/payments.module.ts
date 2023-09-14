import { Module } from '@nestjs/common';
import { PaymentService } from './payments.service';
import { PaymentResolver } from './payments.resolver';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payments.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Restaurant])],
  providers: [PaymentService, PaymentResolver],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
