import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { User, UserRole } from 'src/users/entities/user.entity';
import { CreateOrderInput, CreateOrderOutput } from './dtos/create-order.dto';
import { Restaurant } from 'src/restaurants/entities/restaurant.entity';
import { OrderItem } from './entities/oreder-item.entity';
import { Dish } from 'src/restaurants/entities/dish.entity';
import { GetOrdersInput, GetOrdersOutput } from './dtos/get-orders.dto';
import { GetOrderInput, GetOrderOutput } from './dtos/get-order.dto';
import { EditOrderInput, EditOrderOutput } from './dtos/edit-order.dto';
import {
  NEW_COOKED_ORDER,
  NEW_ORDER_UPDATE,
  NEW_PENDING_ORDER,
  PUB_SUB,
} from 'src/common/common.constants';
import { PubSub } from 'graphql-subscriptions';
import { TakeOrderInput, TakeOrderOutput } from './dtos/take-order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly deshes: Repository<Dish>,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  async createOrder(
    customer: User,
    { restaurantId, items }: CreateOrderInput,
  ): Promise<CreateOrderOutput> {
    try {
      const restaurant = await this.restaurants.findOne({
        where: { id: restaurantId },
      });

      if (!restaurant) {
        return {
          ok: false,
          error: '매장 정보를 찾을 수 없습니다.',
        };
      }
      let orderFinalPrice = 0;
      const orderItems: OrderItem[] = [];
      for (const item of items) {
        const dish = await this.deshes.findOne({ where: { id: item.dishId } });
        if (!dish) {
          return {
            ok: false,
            error: '메뉴를 찾을 수 없습니다.',
          };
        }
        let dishFinalPrice = dish.price;
        for (const itemOption of item.option) {
          const dishOption = dish.options.find(
            (dishOption) => dishOption.name === itemOption.name,
          );

          if (dishOption) {
            if (dishOption.extra) {
              dishFinalPrice += dishOption.extra;
            } else {
              const dishOptionChoice = dishOption.choices.find(
                (optionChoice) => optionChoice.name === itemOption.choices,
              );
              if (dishOptionChoice) {
                if (dishOptionChoice.extra) {
                  dishFinalPrice += dishOptionChoice.extra;
                }
              }
            }
          }
        }

        orderFinalPrice = orderFinalPrice + dishFinalPrice;

        const orderItem = await this.orderItems.save(
          this.orderItems.create({
            dish,
            options: item.option,
          }),
        );
        orderItems.push(orderItem);
      }

      const order = await this.orders.save(
        this.orders.create({
          customer,
          restaurant,
          total: orderFinalPrice,
          items: orderItems,
        }),
      );
      await this.pubSub.publish(NEW_PENDING_ORDER, {
        pendingOrders: { order, ownerId: restaurant.ownerId },
      });
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: '주문에 실패했습니다.',
      };
    }
  }

  async getOrders(
    user: User,
    { orderStatus: status }: GetOrdersInput,
  ): Promise<GetOrdersOutput> {
    try {
      let orders: Order[];
      switch (user.role) {
        case UserRole.Client: {
          orders = await this.orders.find({
            where: {
              customer: {
                id: user.id,
              },
              ...(status && { status }),
            },
          });
          break;
        }
        case UserRole.Delivery: {
          orders = await this.orders.find({
            where: {
              driver: {
                id: user.id,
              },
              ...(status && { status }),
            },
          });
          break;
        }
        case UserRole.Owner: {
          const restaurants = await this.restaurants.find({
            where: {
              owner: {
                id: user.id,
              },
            },
            relations: ['orders'],
          });

          orders = restaurants.map((restaurant) => restaurant.orders).flat(1);
          if (status) {
            orders = orders.filter((order) => order.status === status);
          }
          break;
        }
      }
      return {
        ok: true,
        orders,
      };
    } catch (error) {
      return {
        ok: false,
        error: '주문 목록을 불러오지 못 했습니다.',
      };
    }
  }

  canSeeOrder(user: User, order: Order): boolean {
    let canSee = true;

    switch (user.role) {
      case UserRole.Client:
        canSee = user.id === order.customerId;
        break;
      case UserRole.Delivery:
        canSee = user.id === order.driverId;
        break;
      case UserRole.Owner:
        canSee = user.id === order.restaurant.ownerId;
        break;
    }

    return canSee;
  }

  async getOrder(user: User, { id }: GetOrderInput): Promise<GetOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: {
          id,
        },
        relations: ['restaurant'],
      });
      if (!order) {
        throw new Error();
      }
      if (!this.canSeeOrder(user, order)) {
        return {
          ok: false,
          error: '접근 권한이 없습니다.',
        };
      }
      return {
        ok: true,
        order,
      };
    } catch (error) {
      return {
        ok: false,
        error: '주문 정보를 찾을 수 없습니다.',
      };
    }
  }

  async editOrder(
    user: User,
    { id: orderId, status }: EditOrderInput,
  ): Promise<EditOrderOutput> {
    try {
      const order = await this.orders.findOne({
        where: { id: orderId },
      });

      if (!order) {
        return {
          ok: false,
          error: '주문 정보를 찾을 수 없습니다.',
        };
      }
      if (!this.canSeeOrder(user, order)) {
        return {
          ok: false,
          error: '접근 권한이 없습니다.',
        };
      }

      let canEdit = true;
      if (user.role === UserRole.Owner) {
        if (status !== OrderStatus.Cooking && status !== OrderStatus.Cooked) {
          canEdit = false;
        }
      }

      if (user.role === UserRole.Delivery) {
        if (status !== OrderStatus.PickUp && status !== OrderStatus.Delivered) {
          canEdit = false;
        }
      }
      if (!canEdit) {
        return {
          ok: false,
          error: '접근 권한이 없습니다.',
        };
      }

      await this.orders.save({
        id: order.id,
        status,
      });
      const newOrder = { ...order, status };
      if (user.role === UserRole.Owner) {
        if (status === OrderStatus.Cooked) {
          await this.pubSub.publish(NEW_COOKED_ORDER, {
            cookedOrders: newOrder,
          });
        }
      }
      await this.pubSub.publish(NEW_ORDER_UPDATE, { orderUpdates: newOrder });
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: '주문 상태 변경에 실패 했습니다.',
      };
    }
  }

  async takeOrder(
    driver: User,
    { id: orderId }: TakeOrderInput,
  ): Promise<TakeOrderOutput> {
    try {
      const order = await this.orders.findOne({ where: { id: orderId } });
      if (!order) {
        return {
          ok: false,
          error: '주문정보를 찾을 수 없습니다.',
        };
      }
      if (order.driver) {
        return {
          ok: false,
          error: '이미 배정된 주문입니다.',
        };
      }
      await this.orders.save({
        id: orderId,
        driver,
      });
      await this.pubSub.publish(NEW_ORDER_UPDATE, {
        orderUpdates: { ...order, driver },
      });
      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: '주문 배정에 실패했습니다. ',
      };
    }
  }
}
