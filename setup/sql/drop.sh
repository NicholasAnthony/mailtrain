#!/bin/zsh

/Users/Shared/DBngin/mysql/5.7.23/bin/mysqldump -h "$MYSQL_HOST" -S "/tmp/mysql_3306.sock" -P "$MYSQL_PORT" -u "$MYSQL_USER" "-p${MYSQL_PASSWORD}" --add-drop-table --no-data "$MYSQL_DB" | grep -e '^DROP \| FOREIGN_KEY_CHECKS' | /Users/Shared/DBngin/mysql/5.7.23/bin/mysql -S "/tmp/mysql_3306.sock" -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "-p${MYSQL_PASSWORD}" "$MYSQL_DB"
