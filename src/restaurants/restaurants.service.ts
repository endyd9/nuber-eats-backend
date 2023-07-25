import { Injectable } from '@nestjs/common';
import { Restaurant } from './entities/restaurant.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRestaurantDto } from './dtos/create-restaurant.dto';
import { UpdateRestaurantDto } from './dtos/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurant: Repository<Restaurant>,
  ) {}

  getAll(): Promise<Restaurant[]> {
    return this.restaurant.find();
  }
  createRestaurant(createRestaurantDto: CreateRestaurantDto) {
    const newRestaurant = this.restaurant.create(createRestaurantDto);
    return this.restaurant.save(newRestaurant);
  }

  updateRestaurant({ id, data }: UpdateRestaurantDto) {
    return this.restaurant.update(id, { ...data });
  }
}
