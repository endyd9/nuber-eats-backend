import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaymentService } from './payments.service';
import { Payment } from './entities/payments.entity';
import {
  CreatePaymentInput,
  CreatePaymentOutput,
} from './dtos/create-payment.dto';
import { Role } from 'src/auth/role.decorator';
import { AuthUser } from 'src/auth/auth-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { GetPaymentsOutput } from './dtos/get-payment.dto';

@Resolver((of) => Payment)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Mutation((returns) => CreatePaymentOutput)
  @Role(['Owner'])
  createPayment(
    @AuthUser() owner: User,
    @Args('input') createPaymentInput: CreatePaymentInput,
  ): Promise<CreatePaymentOutput> {
    return this.paymentService.createPayment(owner, createPaymentInput);
  }
  @Query((returns) => GetPaymentsOutput)
  @Role(['Owner'])
  getPayment(@AuthUser() owner: User): Promise<GetPaymentsOutput> {
    return this.paymentService.getPayment(owner);
  }
}
