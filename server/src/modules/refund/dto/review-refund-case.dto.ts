import { Type } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'

export enum RefundReviewActionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewRefundCaseDto {
  @IsEnum(RefundReviewActionDto)
  action: RefundReviewActionDto

  @IsOptional()
  @IsString()
  remark?: string
}
