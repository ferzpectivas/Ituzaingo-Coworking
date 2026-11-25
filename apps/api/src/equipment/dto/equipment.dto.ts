import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ACCESSORY_CODES = ['funda', 'cargador', 'caja', 'hdmi', 'vga', 'cable_energia'] as const;
export type AccessoryCodeDto = (typeof ACCESSORY_CODES)[number];

export class ChecklistDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() funda?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cargador?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() caja?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hdmi?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() vga?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() cable_energia?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observations?: string;
}

export class DeliveryDto {
  @ApiProperty({ type: ChecklistDto, description: 'Checklist de entrega obligatorio' })
  @ValidateNested()
  @Type(() => ChecklistDto)
  checklist!: ChecklistDto;
}

export class IncidentDto {
  @ApiProperty({ enum: ['faltante', 'daño'] })
  @IsIn(['faltante', 'daño'])
  kind!: 'faltante' | 'daño';

  @ApiProperty({ type: [String], enum: ACCESSORY_CODES })
  @IsIn(ACCESSORY_CODES as unknown as string[], { each: true })
  accessories!: AccessoryCodeDto[];

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;
}

export class ReturnDto {
  @ApiProperty({ type: ChecklistDto, description: 'Checklist de devolución' })
  @ValidateNested()
  @Type(() => ChecklistDto)
  checklist!: ChecklistDto;

  @ApiPropertyOptional({ type: IncidentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => IncidentDto)
  incident?: IncidentDto;
}

export class UpdateEquipmentDto {
  @ApiPropertyOptional({ enum: ['disponible', 'mantenimiento'] })
  @IsOptional()
  @IsIn(['disponible', 'mantenimiento'])
  status?: 'disponible' | 'mantenimiento';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class CreateEquipmentDto {
  @ApiProperty({ enum: ['computadora', 'proyector', 'pizarra'] })
  @IsIn(['computadora', 'proyector', 'pizarra'])
  type!: 'computadora' | 'proyector' | 'pizarra';

  @ApiProperty({ example: 'PC-007' })
  @IsString()
  @MaxLength(40)
  assetTag!: string;

  @ApiProperty({ example: 'Lenovo ThinkPad E14' })
  @IsString()
  @MaxLength(80)
  model!: string;

  @ApiProperty({ example: 'SN-PC-007-2026' })
  @IsString()
  @MaxLength(80)
  serial!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class ListEquipmentQuery {
  @ApiPropertyOptional({ enum: ['computadora', 'proyector', 'pizarra'] })
  @IsOptional()
  @IsEnum({ computadora: 'computadora', proyector: 'proyector', pizarra: 'pizarra' })
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}
