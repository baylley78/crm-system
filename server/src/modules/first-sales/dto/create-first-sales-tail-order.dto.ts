import { Type } from 'class-transformer'
import { IsBooleanString, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator'

export class CreateFirstSalesTailOrderDto {
  @IsNumber()
  @Type(() => Number)
  salesUserId: number

  @IsBooleanString()
  isTimelyDeal: string

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  targetAmount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  contractAmount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paymentAmount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  arrearsAmount: number

  @IsNumber()
  @Type(() => Number)
  paymentAccountId: number

  @IsString()
  @IsNotEmpty()
  paymentSerialNo: string

  @IsOptional()
  @IsDateString()
  orderDate?: string

  @IsOptional()
  @IsString()
  remark?: string
}
