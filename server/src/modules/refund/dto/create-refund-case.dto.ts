import { Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, Min, ValidateIf } from 'class-validator'

export enum RefundSourceStageDto {
  FIRST_SALES = 'FIRST_SALES',
  SECOND_SALES = 'SECOND_SALES',
  LEGAL = 'LEGAL',
  MEDIATION = 'MEDIATION',
  THIRD_SALES = 'THIRD_SALES',
  CUSTOMER = 'CUSTOMER',
}

export enum RefundRelatedOrderStageDto {
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  THIRD = 'THIRD',
}

export class CreateRefundCaseDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customerId?: number

  @ValidateIf((_, value) => value !== undefined && value !== '')
  @IsString()
  @IsNotEmpty()
  customerName?: string

  @ValidateIf((object) => !object.customerId)
  @IsPhoneNumber('CN')
  phone?: string

  @IsEnum(RefundSourceStageDto)
  sourceStage: RefundSourceStageDto

  @IsOptional()
  @IsEnum(RefundRelatedOrderStageDto)
  relatedOrderStage?: RefundRelatedOrderStageDto

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  relatedOrderId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  firstSalesDepartmentId?: number

  @IsString()
  @IsNotEmpty()
  reason: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  expectedRefundAmount?: number

  @IsOptional()
  @IsString()
  remark?: string
}
