import { Field, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity()
export class Restaurant {
  @PrimaryGeneratedColumn()
  @Field((type) => Number)
  id: number;

  @Field((type) => String)
  @Column()
  @IsString()
  name: string;

  @Field((type) => Boolean, { nullable: true, defaultValue: false })
  @Column({ default: false })
  @IsOptional()
  @IsBoolean()
  isVegen: boolean;

  @Field((type) => String)
  @Column()
  @IsString()
  address: string;

  @Field((type) => String)
  @Column()
  @IsString()
  owner: string;

  @Field((tpye) => String, { defaultValue: '강남' })
  @Column()
  @IsString()
  categoryName: string;
}
