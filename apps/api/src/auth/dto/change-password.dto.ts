import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Socio1234!' })
  @IsString()
  @MinLength(6, { message: 'Ingresá tu contraseña actual.' })
  @MaxLength(120)
  currentPassword!: string;

  @ApiProperty({
    example: 'Ituzaingo.2026#',
    description: 'Mínimo 10 caracteres, con mayúscula, minúscula y número.',
  })
  @IsString()
  @MinLength(10, { message: 'La nueva contraseña debe tener al menos 10 caracteres.' })
  @MaxLength(120, { message: 'La nueva contraseña no puede superar los 120 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La nueva contraseña debe incluir mayúscula, minúscula y número.',
  })
  newPassword!: string;
}
