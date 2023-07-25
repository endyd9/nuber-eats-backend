import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { Restaurant } from './entities/restaurant.entity';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { RestaurantsService } from './restaurants.service';
import { UpdateRestaurantDto } from './dtos/update-restaurant.dto';

@Resolver((of) => Restaurant)
export class RestaurantResolver {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Query((returns) => [Restaurant])
  restaurant(): Promise<Restaurant[]> {
    return this.restaurantsService.getAll();
  }

  @Mutation((returns) => Boolean)
  async createRestaurant(
    @Args('input') createRestaurantDto: CreateRestaurantDto,
  ): Promise<boolean> {
    try {
      await this.restaurantsService.createRestaurant(createRestaurantDto);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  @Mutation((retruns) => Boolean)
  async updateRestaurant(
    @Args('input') updateRestaurantDto: UpdateRestaurantDto,
  ): Promise<Boolean> {
    try {
      await this.restaurantsService.updateRestaurant(updateRestaurantDto);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
