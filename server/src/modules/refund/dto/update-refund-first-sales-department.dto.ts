import { Type } from 'class-transformer'
import { IsNumber, IsOptional } from 'class-validator'

export class UpdateRefundFirstSalesDepartmentDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  firstSalesDepartmentId?: number
}
