package az.masapay.reservation.dto;

import java.util.List;

/** Every table of the restaurant for a date and time, with its state at that time. */
public record FloorAvailability(String date, String time, List<Integer> floors, List<FloorTable> tables) {
}
