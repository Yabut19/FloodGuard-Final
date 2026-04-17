-- FloodGuard Database Schema (Authoritative)
-- Run once on a fresh MySQL install:
--   mysql -u root floodguard < db_schema.sql
-- For an existing DB, run migrate_all.py instead.

CREATE DATABASE IF NOT EXISTS `floodguard`;
USE `floodguard`;

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin accounts for the web dashboard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admins` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `username`   varchar(255) NOT NULL,
  `full_name`  varchar(255) DEFAULT NULL,
  `phone`      varchar(20) DEFAULT NULL,
  `password`   varchar(255) NOT NULL,
  `role`       enum('super_admin','lgu_admin') NOT NULL DEFAULT 'lgu_admin',
  `status`     varchar(20) DEFAULT 'active',
  `avatar_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Registered mobile app users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`                   int(11) NOT NULL AUTO_INCREMENT,
  `full_name`            varchar(255) NOT NULL,
  `email`                varchar(255) NOT NULL,
  `phone`                varchar(20) NOT NULL,
  `barangay`             varchar(100) DEFAULT NULL,
  `password`             varchar(255) DEFAULT NULL,
  `must_change_password` tinyint(1) DEFAULT 0,
  `role`                 varchar(50) DEFAULT 'user',
  `avatar_url`           varchar(255) DEFAULT NULL,
  `status`               enum('active','inactive') DEFAULT 'active',
  `created_at`           timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- IoT Sensor devices — configuration and metadata
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sensors` (
  `id`              varchar(50) NOT NULL,
  `name`            varchar(100) NOT NULL,
  `barangay`        varchar(100) DEFAULT NULL,
  `description`     text,
  `lat`             decimal(10,8) NOT NULL,
  `lng`             decimal(11,8) NOT NULL,
  `status`          enum('active','inactive','maintenance') DEFAULT 'active',
  `battery_level`   int DEFAULT 100,
  `signal_strength` enum('strong','medium','weak') DEFAULT 'strong',
  `last_update`     timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Historical water level data for charts and analysis
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `water_levels` (
  `id`        int(11) NOT NULL AUTO_INCREMENT,
  `sensor_id` varchar(50) NOT NULL,
  `level`     decimal(10,2) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Full IoT readings including diagnostic data
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `iot_readings` (
  `id`           int(11) NOT NULL AUTO_INCREMENT,
  `sensor_id`    varchar(50) NOT NULL,
  `raw_distance` decimal(10,2) DEFAULT NULL,
  `flood_level`  decimal(10,2) DEFAULT NULL,
  `status`       varchar(50) DEFAULT 'NORMAL',
  `latitude`     decimal(10,8) DEFAULT NULL,
  `longitude`    decimal(11,8) DEFAULT NULL,
  `maps_url`     varchar(500) DEFAULT NULL,
  `created_at`   timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  INDEX `idx_sensor_id` (`sensor_id`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`sensor_id`) REFERENCES `sensors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Emergency alerts and advisories
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `alerts` (
  `id`                 int(11) NOT NULL AUTO_INCREMENT,
  `title`              varchar(255) NOT NULL,
  `description`        text,
  `level`              enum('advisory','watch','warning','critical') NOT NULL,
  `barangay`           varchar(100) DEFAULT NULL,
  `recommended_action` varchar(500) DEFAULT NULL,
  `incident_status`    varchar(100) DEFAULT 'Active',
  `escalation_count`   int(11) NOT NULL DEFAULT 0,
  `timestamp`          timestamp NOT NULL DEFAULT current_timestamp(),
  `status`             enum('active','resolved') DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Community reports submitted via mobile app
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reports` (
  `id`                   int(11) NOT NULL AUTO_INCREMENT,
  `user_id`              int(11) DEFAULT NULL,
  `reporter_name`        varchar(100) DEFAULT 'Anonymous',
  `reporter_email`       varchar(255) DEFAULT NULL,
  `type`                 varchar(50) NOT NULL,
  `location`             varchar(255) NOT NULL,
  `description`          text,
  `image_url`            varchar(255) DEFAULT NULL,
  `verified_by`          varchar(255) DEFAULT NULL,
  `verified_at`          datetime DEFAULT NULL,
  `rejection_reason`     varchar(500) DEFAULT NULL,
  `flood_level_reported` varchar(100) DEFAULT NULL,
  `latitude`             decimal(10,8) DEFAULT NULL,
  `longitude`            decimal(11,8) DEFAULT NULL,
  `maps_url`             varchar(500) DEFAULT NULL,
  `recommendations`      text DEFAULT NULL,
  `report_status`        varchar(100) DEFAULT NULL,
  `timestamp`            timestamp NOT NULL DEFAULT current_timestamp(),
  `status`               enum('pending','verified','dismissed') DEFAULT 'pending',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Evacuation centers information
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `evacuation_centers` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `name`        varchar(255) NOT NULL,
  `location`    varchar(255) NOT NULL,
  `lat`         decimal(10,8) NOT NULL,
  `lng`         decimal(11,8) NOT NULL,
  `capacity`    int(11) DEFAULT 0,
  `slots_filled`int(11) DEFAULT 0,
  `status`      enum('open','full','closed') DEFAULT 'open',
  `phone`       varchar(20) DEFAULT NULL,
  `created_at`  timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- User subscriptions to barangay alerts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_subscriptions` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `user_id`    int(11) NOT NULL,
  `barangay`   varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_subscription` (`user_id`, `barangay`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alert escalation audit log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `alert_escalation_log` (
  `id`           int(11) NOT NULL AUTO_INCREMENT,
  `alert_id`     int(11) NOT NULL,
  `from_level`   varchar(20) DEFAULT NULL,
  `to_level`     varchar(20) NOT NULL,
  `reason`       varchar(255) DEFAULT 'Manual escalation',
  `escalated_by` varchar(100) DEFAULT 'system',
  `escalated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-user alert dismissals (mobile app only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_alert_dismissals` (
  `id`           int NOT NULL AUTO_INCREMENT,
  `user_id`      int NOT NULL,
  `alert_id`     int NOT NULL,
  `dismissed_at` timestamp DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_alert` (`user_id`, `alert_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data — default admin accounts
-- Default password for admin@system.com : admin123
-- Default password for moderator@lgu.gov: password123
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO `admins` (`username`, `full_name`, `password`, `role`) VALUES
('admin@system.com', 'Super Admin', 'scrypt:32768:8:1$12Jjtqo4$c62fa32f70f45d0029c304ba7eb5982d37748c', 'super_admin')
ON DUPLICATE KEY UPDATE password=VALUES(password), role=VALUES(role);

INSERT INTO `admins` (`username`, `full_name`, `password`, `role`) VALUES
('moderator@lgu.gov', 'LGU Moderator', 'scrypt:32768:8:1$kJCjfddr$kF', 'lgu_admin')
ON DUPLICATE KEY UPDATE password=VALUES(password), role=VALUES(role);
