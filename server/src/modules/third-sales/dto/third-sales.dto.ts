import { Type } from 'class-transformer'
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

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
  @IsIn(['DEPOSIT', 'TAIL', 'FULL'])
  orderType: 'DEPOSIT' | 'TAIL' | 'FULL'

  @IsString()
  @IsNotEmpty()
  productName: string

  @IsString()
  @IsNotEmpty()
  paymentAmount: string

  @IsString()
  @IsNotEmpty()
  contractAmount: string

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
