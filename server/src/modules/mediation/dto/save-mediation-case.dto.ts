import { Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class SaveMediationCaseDto {
  @IsNumber()
  @Type(() => Number)
  customerId: number

  @IsString()
  @IsNotEmpty()
  progressStatus: string

  @IsOptional()
  @IsString()
  mediationResult?: string

  @IsOptional()
  @IsString()
  remark?: string

  @IsOptional()
  @IsString()
  evidenceFileUrls?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean
}
