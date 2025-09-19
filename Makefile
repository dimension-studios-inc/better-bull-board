
up:
	docker compose -f docker/compose.local.yaml up -d

down:
	docker compose -f docker/compose.local.yaml down

logs:
	docker compose -f docker/compose.local.yaml logs -f
