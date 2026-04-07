import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateCustomerFollowDto {
  @IsString()
  @IsNotEmpty()
  content: string

  @IsOptional()
  @IsDateString()
  nextFollowTime?: string
}
