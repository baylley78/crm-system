import { Type } from 'class-transformer'
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class SearchThirdSalesCustomerDto {
  @IsString()
  @IsNotEmpty()
  phone: string
}

export class CreateThirdSalesOrderDto {
  @IsString()
  @IsNotEmpty()
  phone: string

  @IsNumber()
  @Type(() => Number)
  thirdSalesUserId: number

  @IsString()
  @IsNotEmpty()
  productName: string

  @IsString()
  @IsNotEmpty()
  paymentAmount: string

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
  customerName?: string

  @IsOptional()
  @IsString()
  caseType?: string

  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  intentionLevel?: string

  @IsOptional()
  @IsString()
  remark?: string

  @IsOptional()
  @IsString()
  evidenceFileUrls?: string
}
