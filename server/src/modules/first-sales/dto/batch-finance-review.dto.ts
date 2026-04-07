import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { FinanceReviewActionTypeDto } from './finance-review-action.dto'

export class BatchFinanceReviewDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Type(() => Number)
  orderIds: number[]

  @IsEnum(FinanceReviewActionTypeDto)
  action: FinanceReviewActionTypeDto

  @IsOptional()
  @IsString()
  remark?: string
}
