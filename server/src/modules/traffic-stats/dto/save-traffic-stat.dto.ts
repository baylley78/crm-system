import { Type } from 'class-transformer'
import { IsDateString, IsNotEmpty, IsNumber, Min } from 'class-validator'

export class SaveTrafficStatDto {
  @IsDateString()
  @IsNotEmpty()
  reportDate: string

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  transferCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  addCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  depositCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tailCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fullCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  timelyCount: number

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalPerformance: number
}
