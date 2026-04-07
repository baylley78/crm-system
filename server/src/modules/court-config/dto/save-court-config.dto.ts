import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class SaveCourtConfigDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hearingCost: number

  @IsOptional()
  @IsString()
  remark?: string
}
