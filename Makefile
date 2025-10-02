
up:
	docker compose -f docker/compose.local.yaml up -d --build

down:
	docker compose -f docker/compose.local.yaml down

logs:
	docker compose -f docker/compose.local.yaml logs -f

down-volumes:
	docker compose -f docker/compose.local.yaml down -v

empty-data:
	docker exec -it better-bull-board_postgres psql -U postgres -d postgres -c "DELETE FROM job_runs"
	docker exec -it better-bull-board_postgres psql -U postgres -d postgres -c "DELETE FROM queues"
	docker exec -it better-bull-board_clickhouse clickhouse-client -h localhost -u default --passwor password --query "TRUNCATE TABLE default.job_runs_ch"