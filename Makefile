.PHONY: help dev dev-backend dev-frontend build up down logs seed test migrate clean

help:
	@echo "Paroikiapp - Comandos disponibles"
	@echo ""
	@echo "Desarrollo:"
	@echo "  make dev              - Inicia backend y frontend en desarrollo"
	@echo "  make dev-backend      - Inicia solo el backend"
	@echo "  make dev-frontend     - Inicia solo el frontend"
	@echo ""
	@echo "Docker:"
	@echo "  make build            - Construye imágenes Docker"
	@echo "  make up               - Levanta servicios con Docker Compose"
	@echo "  make down             - Detiene servicios"
	@echo "  make logs             - Muestra logs en vivo"
	@echo ""
	@echo "Base de datos:"
	@echo "  make migrate          - Ejecuta migraciones"
	@echo "  make seed             - Carga datos de prueba"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Ejecuta tests"
	@echo ""
	@echo "Limpieza:"
	@echo "  make clean            - Limpia contenedores y volúmenes"

dev:
	@echo "Iniciando aplicación en desarrollo..."
	@echo "Backend en http://localhost:3001"
	@echo "Frontend en http://localhost:3000"
	@concurrently "cd backend && npm run dev" "cd frontend && npm run dev"

dev-backend:
	@cd backend && npm run dev

dev-frontend:
	@cd frontend && npm run dev

build:
	@docker-compose build --no-cache

up:
	@docker-compose up -d

down:
	@docker-compose down

logs:
	@docker-compose logs -f

migrate:
	@docker-compose exec backend npm run migrate

seed:
	@docker-compose exec backend npm run seed

test:
	@cd backend && npm test

clean:
	@docker-compose down -v
	@rm -rf uploads/
	@rm -rf backend/node_modules frontend/node_modules
	@echo "Limpieza completada"

ps:
	@docker-compose ps

shell-db:
	@docker-compose exec postgres psql -U camposter -d campregister

shell-backend:
	@docker-compose exec backend sh

restart-backend:
	@docker-compose restart backend

restart-frontend:
	@docker-compose restart frontend
