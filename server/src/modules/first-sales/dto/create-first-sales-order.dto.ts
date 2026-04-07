import { Type } from 'class-transformer'
import { IsBooleanString, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export enum FirstOrderTypeDto {
  DEPOSIT = 'DEPOSIT',
  TAIL = 'TAIL',
  FULL = 'FULL',
}

export class CreateFirstSalesOrderDto {
  @IsString()
  @IsNotEmpty()
  customerName: string

  @IsString()
  @IsNotEmpty()
  phone: string

  @IsOptional()
  @IsString()
  wechat?: string

  @IsOptional()
  @IsString()
  gender?: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  age?: number

  @IsOptional()
  @IsString()
  province?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  caseType?: string

  @IsOptional()
  @IsString()
  intentionLevel?: string

  @IsNumber()
  @Type(() => Number)
  salesUserId: number

  @IsEnum(FirstOrderTypeDto)
  orderType: FirstOrderTypeDto

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
