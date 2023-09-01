import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from './entities/payments.entity';
import { LessThan, Repository } from 'typeorm';
import {
  CreatePaymentInput,
  CreatePaymentOutput,
} from './dtos/create-payment.dto';
import { User } from 'src/users/entities/user.entity';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { GetPaymentsOutput } from './dtos/get-payment.dto';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Restaurant)
    private readonly restaurant: Repository<Restaurant>,
  ) {}

  async createPayment(
    owner: User,
    { transactionId, restaurantId }: CreatePaymentInput,
  ): Promise<CreatePaymentOutput> {
    try {
      const restaurant = await this.restaurant.findOne({
        where: { id: restaurantId },
      });
      if (!restaurant) {
        return {
          ok: false,
          error: '매장 정보를 찾을 수 없습니다.',
        };
      }
      if (restaurant.ownerId !== owner.id) {
        return {
          ok: false,
          error: '잘못된 접근',
        };
      }
      await this.payments.save(
        this.payments.create({
          transactionId,
          user: owner,
          restaurant,
        }),
      );

      restaurant.isPromoted = true;
      const date = new Date();
      date.setDate(date.getDate() + 7);
      restaurant.promotedUntil = date;
      this.restaurant.save(restaurant);

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: '결제에 실패 했습니다.',
      };
    }
  }

  async getPayment(user: User): Promise<GetPaymentsOutput> {
    try {
      const payments = await this.payments.find({
        where: { user: { id: user.id } },
      });

      return {
        ok: true,
        payments,
      };
    } catch (error) {
      return {
        ok: false,
        error: '결제 내역을 불러오지 못 했습니다.',
      };
    }
  }

  @Interval(60000)
  async checkPromotedRestaurants() {
    const restaurants = await this.restaurant.find({
      where: { isPromoted: true, promotedUntil: LessThan(new Date()) },
    });
    restaurants.forEach(async (restaurant) => {
      restaurant.isPromoted = false;
      restaurant.promotedUntil = null;
      await this.restaurant.save(restaurant);
    });
  }
}
