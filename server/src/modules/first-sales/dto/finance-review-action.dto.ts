import { IsEnum, IsOptional, IsString } from 'class-validator'

export enum FinanceReviewActionTypeDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class FinanceReviewActionDto {
  @IsEnum(FinanceReviewActionTypeDto)
  action: FinanceReviewActionTypeDto

  @IsOptional()
  @IsString()
  remark?: string
}
