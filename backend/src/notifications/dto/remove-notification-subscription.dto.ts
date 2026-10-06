import { IsUrl, MaxLength } from 'class-validator';

export class RemoveNotificationSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
}
