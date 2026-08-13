-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: mariadb
-- Erstellungszeit: 13. Aug 2026 um 17:41
-- Server-Version: 12.2.2-MariaDB-ubu2404
-- PHP-Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Datenbank: `Spotify-test`
--

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `spotify_tracks`
--

CREATE TABLE `spotify_tracks` (
  `id` int(11) NOT NULL,
  `played_at` datetime NOT NULL,
  `played_date` date NOT NULL,
  `played_time` time NOT NULL,
  `track_id` varchar(255) NOT NULL,
  `track_name` varchar(500) NOT NULL,
  `artist_name` varchar(500) NOT NULL,
  `album_name` varchar(500) NOT NULL,
  `duration_ms` int(11) NOT NULL,
  `duration_min` decimal(10,2) NOT NULL,
  `track_url` varchar(500) DEFAULT NULL,
  `album_url` varchar(500) DEFAULT NULL,
  `popularity` int(11) DEFAULT NULL,
  `explicit` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indizes der exportierten Tabellen
--

--
-- Indizes für die Tabelle `spotify_tracks`
--
ALTER TABLE `spotify_tracks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_play` (`track_id`,`played_at`),
  ADD KEY `idx_played_date` (`played_date`),
  ADD KEY `idx_track_id` (`track_id`);

--
-- AUTO_INCREMENT für exportierte Tabellen
--

--
-- AUTO_INCREMENT für Tabelle `spotify_tracks`
--
ALTER TABLE `spotify_tracks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
