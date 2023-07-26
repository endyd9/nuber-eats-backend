import { Field, ObjectType } from '@nestjs/graphql/dist/decorators';

@ObjectType()
export class CoreOutput {
  @Field((type) => String, { nullable: true })
  error?: string;

  @Field((type) => Boolean)
  ok: boolean;
}
