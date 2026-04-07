import { Type } from 'class-transformer'
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateQualityRecordDto {
  @IsDateString()
  @IsNotEmpty()
  recordDate: string

  @IsNumber()
  @Type(() => Number)
  responsibleId: number

  @IsString()
  @IsNotEmpty()
  matter: string

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  penaltyAmount: number

  @IsOptional()
  @IsString()
  screenshotUrl?: string
}
