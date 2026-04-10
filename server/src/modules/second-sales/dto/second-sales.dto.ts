import { Type, Transform } from 'class-transformer'
import { IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class SearchCustomerByPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string
}

export class AssignSecondSalesDto {
  @IsNumber()
  @Type(() => Number)
  customerId: number

  @IsNumber()
  @Type(() => Number)
  secondSalesUserId: number

  @IsOptional()
  @IsString()
  remark?: string
}

export class CreateSecondSalesOrderDto {
  @IsString()
  @IsNotEmpty()
  phone: string

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  secondSalesUserId: number

  @IsString()
  @IsIn(['DEPOSIT', 'TAIL', 'FULL'])
  orderType: 'DEPOSIT' | 'TAIL' | 'FULL'

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  secondPaymentAmount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  contractAmount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paymentAccountId: number

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  includesHearing: boolean

  @IsString()
  @IsNotEmpty()
  paymentSerialNo: string

  @IsIn(['LEGAL'])
  nextStage: 'LEGAL'

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
}

export class TransferToMediationDto {
  @IsNumber()
  @Type(() => Number)
  customerId: number
}
