import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsNumber } from 'class-validator'

export class BatchDeleteTrafficStatsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Type(() => Number)
  ids: number[]
}
