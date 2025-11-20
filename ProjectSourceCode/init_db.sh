#!/bin/bash

# DO NOT PUSH THIS FILE TO GITHUB
# This file contains sensitive information and should be kept private

# TODO: Set your PostgreSQL URI - Use the External Database URL from the Render dashboard
PG_URI="postgresql://buffsdb_user:YbfyyoDHUxGCOpQ1xr10UfJO5l35okGU@dpg-d4fplh2li9vc73cppgag-a.oregon-postgres.render.com/buffsdb"

# Execute each .sql file in the directory
for file in init_data/*.sql; do
    echo "Executing $file..."
    psql $PG_URI -f "$file"
done