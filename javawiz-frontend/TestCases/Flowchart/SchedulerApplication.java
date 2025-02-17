

/**
 * Application class for working with semester schedule.
 * The class allows to read in different operation codes from the console
 * and execute operations for defining and reading the semester schedule.
 */
public class SchedulerApplication {

    /**
     * the semester schedule
     */
    private static Semester semester; 
  
    /**
     * Starts the application by creating a semester scheduler and starting it.
     *
     * @param args
     */
    public static void main(String[] args) {
      Out.print("Please enter the number of weeks in the semester: ");
      int weeks = In.readInt();
      In.readLine();
      semester = new Semester(weeks); 
      run();
    }
  
    /**
     * Implements the main interaction loop.
     */
    public static void run() {
      Out.println("==================");
      Out.println("Plan your semester");
      Out.println("==================");
      Command cmd;
      do {
        cmd = readCommand();
        switch (cmd) {
          case AA -> addAll();
          case AS -> addSingle();
          case RS -> remSingle();
          case RN -> removeNamed();
          case PD -> printDay();
          case PN -> printNext();
          case PA -> printAll();
          case X -> nop();
        }
      } while (!cmd.equals(Command.X));
      Out.println();
      Out.println("Goodbye! See you again!");
    }
  
    /**
     * Reads the command code from the console.
     *
     * @return the command code
     */
    private static Command readCommand() {
      Out.println("------------------------------------");
      Out.println("Choose one of the following options:");
      Out.println("  AA (Add All)       - Add a unit with given name, weekday, start time and duration in all weeks of the semester");
      Out.println("  AS (Add Single)    - Add a unit with given name, weekday, start time and duration in a given week");
      Out.println("  RS (Remove Single) - Remove a unit with given start time, on a given weekday in a given week");
      Out.println("  RN (Remove Named)  - Remove all units in the whole semester with a given name");
      Out.println("  PD (Print Day)     - Print all units on a given weekday in a given week");
      Out.println("  PN (Print Next)    - Print the next unit on a given weekday in a given week after a given start time");
      Out.println("  PA (Print All)     - Print all units in the whole semester");
      Out.println("  X                  - End program ");
      Out.println("------------------------------------");
      Out.print("> ");
  
      Command cmd = null;
      boolean valid = false;
      String op = In.readLine().trim().toUpperCase();
      while (!valid) {
        try {
          cmd = Command.valueOf(op);
          valid = true;
        } catch (IllegalArgumentException e) {
          Out.println("Invalid operation! Please repeat");
          Out.print("> ");
          op = In.readLine().trim().toUpperCase();
        }
      }
      return cmd;
    }
  
    /**
     * Defines a lecture for the whole semester.
     */
    private static void addAll() {
      Out.println("Add a unit with given name, on given weekday, with given start time and duration in all weeks of the semester:");
      String name = readName("unit name");
      Weekday weekday = readWeekday();
      Time time = readTime("start");
      int duration = readInt("duration", 0, 720);
      boolean[] success = semester.addUnitInAllWeeks(weekday, name, time, duration);
      for(int i = 0; i < success.length; i++) {
        if(success[i]) {
          Out.println("  Unit successfully added in week %d".formatted(i + 1));
        } else {
          Out.println("  Unit could not be added in week %d due to a conflict".formatted(i + 1));
        }
      }
    }
  
    /**
     * Defines a lecture for a single week.
     */
    private static void addSingle() {
      Out.println("Add a unit with given name, on given weekday, with given start time and duration in a given week:");
      String name = readName("name");
      Weekday weekday = readWeekday();
      Time time = readTime("start");
      int duration = readInt("duration", 0, 720);
      int week = readInt("week", 1, semester.numberOfWeeks());
      if(!semester.addUnitInSingleWeek(week, weekday, name, time, duration)) {
        Out.println("  Unit could not be added in week %d due to a conflict".formatted(week));
      }
    }
  
    /**
     * Removes a lecture for a single week.
     */
    private static void remSingle() {
      Out.println("Remove a unit with given start time, on a given weekday in a given week");
      Time time = readTime("start");
      Weekday weekday = readWeekday();
      int week = readInt("week", 1, semester.numberOfWeeks());
      if(semester.removeUnitInSingleWeek(week, weekday, time)) {
        Out.println("  Unit removed successfully");
      } else {
        Out.println("  Unit could not be removed");
      }
    }
  
    /**
     * Removes all lectures with a given name.
     */
    private static void removeNamed() {
      Out.println("Remove all units in the whole semester with a given name");
      String name = readName("name");
      semester.removeAllNamed(name);
    }
  
    /**
     * Prints all lectures for a single day.
     */
    private static void printDay() {
      Out.println("Print all units on a given weekday in a given week");
      Weekday weekday = readWeekday();
      int week = readInt("week", 1, semester.numberOfWeeks());
      Unit[] units = semester.unitsOn(week, weekday);
      if (units == null || units.length == 0) {
        Out.println("  No units on the given day!");
      } else {
        for (Unit unit : units) {
          Out.println("  " + unit);
        }
      }
    }
  
    /**
     * Prints the next lecture after a given time on a given day.
     */
    private static void printNext() {
      Out.println("Print the next unit on a given weekday in a given week after a given start time");
      Weekday weekday = readWeekday();
      int week = readInt("week", 1, semester.numberOfWeeks());
      Time time = readTime("start");
      Unit unit = semester.nextUnitOn(week, weekday, time);
      if (unit != null) {
        Out.println("  " + unit);
      } else {
        Out.println("  No unit found!");
      }
    }
  
    /**
     * Prints all lectures.
     */
    private static void printAll() {
      Out.println("Print all units in the whole semester");
      Unit[] units = semester.units();
      if (units == null || units.length == 0) {
        Out.println("  No unit in the semester!");
      } else {
        for (Unit unit : units) {
          Out.println("  " + unit);
        }
      }
    }
  
    // ------------------ Helper methods ------------------
  
    /**
     * Reads a weekday from the console.
     *
     * @return the weekday
     */
    private static Weekday readWeekday() {
      int nr = readInt("weekday", 1, 7);
      return Weekday.getWeekday(nr);
    }
  
    /**
     * Reads in a name from the console.
     *
     * @param msg the message prompt
     * @return the name read
     */
    private static String readName(String msg) {
      Out.print("  Please enter %s: ".formatted(msg));
      return In.readLine();
    }
  
    /**
     * Reads an int value.
     *
     * @param msg the message prompt
     * @return the integer read
     */
    private static int readInt(String msg, int fromInclusive, int toInclusive) {
      Out.print("  Please enter an integer number for %s (%d - %d): ".formatted(msg, fromInclusive, toInclusive));
      int number = In.readInt();
      while (number < fromInclusive || number > toInclusive) {
        Out.println("  Invalid number! Please repeat");
        Out.print("  Please enter an integer number for %s (%d - %d): ".formatted(msg, fromInclusive, toInclusive));
        number = In.readInt();
      }
      In.readLine();
      return number;
    }
  
    /**
     * Reads a time from the console.
     *
     * @param msg the message prompt
     * @return the time read
     */
    private static Time readTime(String msg) {
      Out.print("  Please enter %s time (hh:mm): ".formatted(msg));
      int hour = In.readInt();
      In.read();
      int min = In.readInt();
      while (!DateTimeUtil.isValidTime(hour, min)) {
        Out.println("  Invalid time! Please repeat");
        Out.print("  Please enter %s time (hh:mm): ".formatted(msg));
        hour = In.readInt();
        In.read();
        min = In.readInt();
      }
      In.readLine();
      return new Time(hour, min);
    }
  
    /**
     * No operation
     */
    private static void nop() {
    }
  
  }
  
  /**
   * Enumeration for user commands.
   */
  enum Command {
    AA, AS, RS, RN, PD, PN, PA, X
  }
  
  class Day {
      
      private final int week; 
      private final Weekday weekday; 
      private final UnitList units;
  
      Day(int week, Weekday weekday) {
          super();
          this.week = week;
          this.weekday = weekday;
          this.units = new UnitList();
      }
  
      boolean addUnit(String name, Time from, int duration) {
          if (units.containsOverlapping(from, duration)) {
              return false;
          }
          units.add(new Unit(name, week, weekday, from, duration));
          return true;
      }
      
      boolean removeUnit(Time time) {
          return units.remove(time);
      }
  
      boolean removeUnit(Unit unit) {
          if (unit.weekday() == weekday && unit.week() == week) {
              return units.remove(unit.time());
          }
          return false;
      }
  
      Unit[] units() {
          return units.toArray();
      }
  
      Unit nextUnit(Time time) {
          return units.unitAfter(time);
      }
  
      Unit[] unitsNamed(String name) {
          return units.unitsNamed(name);
      }
  
      @Override
      public String toString() {
          return String.format("Day: %1$s, week %2$d", weekday, week); 
      }
      
  
  }
  
  class Semester {
      private final Day[][] weeks;
    
      public Semester(int nWeeks) {
        weeks = new Day[nWeeks + 1][8]; // 0 not used
        for (int w = 1; w < weeks.length; w++) {
          for (int d = 1; d < weeks[w].length; d++) {
            weeks[w][d] = new Day(w, Weekday.getWeekday(d));
          }
        }
      }
    
      public int numberOfWeeks() {
        return weeks.length - 1;
      }
    
      public boolean[] addUnitInAllWeeks(Weekday weekday, String name, Time from, int duration) {
        boolean[] success = new boolean[numberOfWeeks()];
        for (int w = 1; w < weeks.length; w++) {
          success[w - 1] = addUnitInSingleWeek(w, weekday, name, from, duration);
        }
        return success;
      }
    
      public boolean addUnitInSingleWeek(int week, Weekday weekday, String name, Time from, int duration) {
        Day day = day(week, weekday);
        if (day == null) {
          return false;
        }
        return day.addUnit(name, from, duration);
      }
    
      public boolean removeUnitInSingleWeek(int week, Weekday weekday, Time time) {
        Day day = day(week, weekday);
        if (day == null) {
          return false;
        }
        return day.removeUnit(time);
      }
    
      public Unit[] unitsOn(int week, Weekday weekday) {
        Day day = day(week, weekday);
        if (day == null) {
          return null;
        }
        return day.units();
      }
    
      public Unit nextUnitOn(int week, Weekday weekday, Time time) {
        Day day = day(week, weekday);
        if (day == null) {
          return null;
        }
        return day.nextUnit(time);
      }
    
      public void removeAllNamed(String name) {
        for (int w = 1; w < weeks.length; w++) {
          for (int d = 1; d < weeks[w].length; d++) {
            Day day = weeks[w][d];
            Unit[] units = day.unitsNamed(name);
            if (units != null) {
              for (Unit unit : units) {
                day.removeUnit(unit.time());
              }
            }
          }
        }
      }
    
      public Unit[] units() {
        int count = 0;
        for (int w = 1; w < weeks.length; w++) {
          for (int d = 1; d < weeks[w].length; d++) {
            Unit[] units = weeks[w][d].units();
            if (units != null) {
              for (Unit unit : units) {
                count++;
              }
            }
          }
        }
        Unit[] units = new Unit[count];
        int i = 0;
        for (int w = 1; w < weeks.length; w++) {
          for (int d = 1; d < weeks[w].length; d++) {
            Unit[] dayUnits = weeks[w][d].units();
            if (dayUnits != null) {
              for (Unit unit : dayUnits) {
                units[i] = unit;
                i++;
              }
            }
          }
        }
        return units;
      }
    
      private Day day(int week, Weekday weekday) {
        if (week < 1 || week >= weeks.length) {
          return null;
        }
        return weeks[week][weekday.nr];
      }
    }
  
  
  
    /**
     * The record class <code>Date</code> represents a specific date with day, month, and
     * year.
     */
  record Date(int day, int month, int year) implements Comparable<Date> {
    
        /*
         * (non-Javadoc)
         * 
         * @see java.lang.Comparable#compareTo(java.lang.Object)
         */
        public int compareTo(Date d) {
            int compare = year() - d.year();
            if (compare == 0) {
                compare = month() - d.month();
            }
            if (compare == 0) {
                compare = day() - d.day();
            }
            return compare;
        }
    
        /*
         * (non-Javadoc)
         * 
         * @see java.lang.Object#toString()
         */
        @Override
        public String toString() {
            return String.format("%1$d.%2$d.%3$d.", day(), month(), year());
        }
    }
      
  /**
   * This class consists exclusively of static methods that provide utility
   * functions for dealing with date and time.
   */
   class DateTimeUtil {
      
      /**
       * Tests if the given year is a leap year
       * 
       * @param year
       *            the year given as an integer.
       * @return <code>true</code> if the year is a leap year,
       *         <code>false</code> otherwise
       */
      public static boolean isLeapYear(int year) {
          return year % 4 == 0 && !(year % 100 == 0 && year % 400 != 0);
      }
  
      /**
       * Returns the number of days in the given year, i.e., 366 for leap years
       * and 365 for normal years.
       * 
       * @param year
       *            the year given as an integer.
       * @return 366 for leap years and 365 for normal years.
       */
      public static int nrDaysInYear(int year) {
          if (isLeapYear(year)) {
              return 366;
          }
          return 365;
      }
  
      /**
       * Returns the number of days for a given month in a specific year. Notice
       * that the number of days for February is different for leap years and
       * therefore the year is required as an additional parameter.
       * 
       * @param month
       *            the month given as an integer between 1 and 12.
       * @param year
       *            the year given as an integer.
       * @return the number of days in the given month and year; -1 if month is
       *         not valid
       */
      public static int nrDaysInMonth(int month, int year) {
          switch (month) {
          case 1: case 3: case 5: case 7: case 8: case 10: case 12: 
              return 31;
          case 4: case 6: case 9: case 11:
              return 30;
          case 2:
              return isLeapYear(year) ? 29 : 28;
          default:
              return -1;
          }
      }
  
      /**
       * Tests if the time given by hour and minute represents a valid time. A
       * time is valid if hour is between 0 and 23 and minute is between 0 and 59
       * or if hour is 24 and minute is 0.
       * 
       * @param hour
       *            the hour value
       * @param min
       *            the minute value
       * @return true if <code>hour</code> and <code>min</code> represent a
       *         valid time.
       */
      public static boolean isValidTime(int hour, int min) {
          return hour >= 0 && hour <= 23 && min >= 0 && min < 60 || hour == 24 && min == 0;
      }
  
      /**
       * Computes the minutes passed in a day given a <code>Time</code> value.
       * The minutes of a day are computed by <code>hour * 60 + min</code>. For
       * example, for time 10:01 the minutes of a day are 601.
       * 
       * @param time
       *            the <Time> object representing a time.
       * @return the minutes of a day for the given time.
       */
      public static int minsOfDayFromTime(Time time) {
          return time.hour() * 60 + time.min();
      }
  
      /**
       * Returns the <code>Time</code> object from given minutes of a day. For
       * example, for minutes of a day of 601 the <code>Time</code> object
       * representing 10:01 is returned.
       * 
       * @param minsOfDay
       *            the minutes of a day
       * @return the <code>Time</code> object for the minutes of day.
       */
      public static Time timeFromMinsOfDay(int minsOfDay) {
          int hour = (minsOfDay / 60) % 24;
          int min = minsOfDay % 60;
          return new Time(hour, min);
      }
  
      /**
       * Returns a <code>Time</code> object which represents the time after a
       * specified time span.
       * 
       * @param time
       *            the time given
       * @param timeSpan
       *            the time span given in minutes
       * @return the <code>Time</code> object representing the time after
       *         <code>timeSpan</code> minutes.
       */
      public static Time timeAfter(Time time, int timeSpan) {
          return timeFromMinsOfDay(minsOfDayFromTime(time) + timeSpan);
      }
  
      /**
       * Tests if the date given by day, month, and year represents a valid date.
       * A date is valid if month is between 1 and 12 and day is between 1 and the
       * number of days in the given month. No restrictions apply for year.
       * 
       * @param day
       *            the day value of the date
       * @param month
       *            the month value of the date
       * @param year
       *            the year value of the date
       * @return <code>true</code>, if <code>day</code>, <code>month</code>,
       *         and <code>year</code> represent a valid date,
       *         <code>false</code> otherwise.
       */
      public static boolean isValidDate(int day, int month, int year) {
          return month >= 1 && month <= 12 && day >= 1 && day <= nrDaysInMonth(month, year);
      }
  
      /**
       * Computes the integer value which represents the day of year for a given
       * date. For example for Jan 1st, the day of year is 1, for Feb, 1st the day
       * of year is 32, and for Dec 31st, 2007 (no leap year) the day of year is
       * 365.
       * 
       * @param date
       *            the <code>Date</code> object
       * @return the integer value between 365 (366 for leap years) representing
       *         the day of year for the given date.
       */
      public static int dayOfYearFromDate(Date date) {
          int dayOfYear = 0;
          for (int month = 1; month < date.month(); month++) {
              dayOfYear += nrDaysInMonth(month, date.year());
          }
          dayOfYear += date.day();
          return dayOfYear;
      }
  
      /**
       * Returns a <code>Date</code> object for a given day of year and a given
       * year. For example, for year being 2007 and for a day of year value of 1
       * the date is Jan 1st, 2007, for a day of year value of 32 the date is Feb
       * 1st, 2007, and for a day of year value of 365 the date is Dec 31st, 2007.
       * 
       * @param dayOfYear
       *            the day in the year which should be a value between 365 (366
       *            for leap years)
       * @param year
       *            the year value
       * @return the <code>Date</code> object representing the given day of
       *         year; <code>null</code> if <code>dayOfYear</code> is not
       *         valid.
       */
      public static Date dateFromDayOfYear(int dayOfYear, int year) {
          if (dayOfYear < 1 || dayOfYear > nrDaysInYear(year)) {
              return null;
          }
          int days = 0;
          int month = 1;
          while (days + nrDaysInMonth(month, year) < dayOfYear) {
              days += nrDaysInMonth(month, year);
              month++;
          }
          int day = dayOfYear - days;
          return new Date(day, month, year);
      }
  
      /**
       * Returns the <code>Date</code> object for the next day of a given a
       * <code>Date</code> object. Returns <code>null</code> if the given date
       * is the last day in the year.
       * 
       * @param date
       *            the <code>Date</code> object given
       * @return the <code>Date</code> object representing the next day;
       *         <code>null</code> if the given date is the last day in the
       *         year.
       */
      public static Date getNextDate(Date date) {
          int next = dayOfYearFromDate(date);
          next++;
          if (next <= nrDaysInYear(date.year())) {
              return dateFromDayOfYear(next, date.year());
          }
          return null;
      }
  
      /**
       * Returns the <code>Date</code> object for the previous day of a given a
       * <code>Date</code> object. Returns <code>null</code> if the given date
       * is the first day in the year.
       * 
       * @param date
       *            the <code>Date</code> object given
       * @return the <code>Date</code> object representing the previous day;
       *         <code>null</code> if the given date is the first day in the
       *         year.
       */
      public static Date getPreviousDate(Date date) {
          int prev = dayOfYearFromDate(date);
          prev--;
          if (prev > 0) {
              return dateFromDayOfYear(prev, date.year());
          }
          return null;
      }
  }
  
  /**
   * The record <code>Time</code> represents a specific time of day with hour and
   * minutes.
   *
   * @param hour the hour of time between 0 and 23
   * @param min  the minutes of time between 0 and 59
   */
  record Time(int hour, int min) implements Comparable<Time> {
      /*
       * (non-Javadoc)
       *
       * @see java.lang.Comparable#compareTo(java.lang.Object)
       */
      @Override
      public int compareTo(Time t) {
        int compare = hour - t.hour;
        if (compare == 0) {
          compare = min - t.min;
        }
        return compare;
      }
    
      /*
       * (non-Javadoc)
       *
       * @see java.lang.Record#toString()
       */
      @Override
      public String toString() {
        return String.format("%02d:%02d", hour, min);
      }
  
      }
    
      
  record Unit(String name, int week, Weekday weekday, Time time, int duration) {
  
          public Time end() {
              return DateTimeUtil.timeAfter(time, duration);
          }
      
          @Override
          public String toString() {
              return String.format("%s - Week %d, %s, %s - %s",
                              name, week, weekday, time, end());
          }
          
      }
  
      
  
  class UnitList {
  
      private UnitNode head = null;
      private int length = 0;
    
      void add(Unit unit) {
        if (unit == null) {
          return;
        }
        UnitNode node = new UnitNode(unit);
        UnitNode curr = head;
        UnitNode prev = null;
        if (curr == null) {
          head = node;
        } else {
          while (curr != null && unit.time().compareTo(curr.unit().time()) > 0) {
            prev = curr;
            curr = curr.next();
          }
          if (prev == null) {
            head = node;
          } else {
            prev.next(node);
          }
          node.next(curr);
        }
        length++;
      }
    
      boolean remove(Time time) {
        if (time == null) {
          return false;
        }
        UnitNode toRemove = head;
        UnitNode prev = null;
        while (toRemove != null && !toRemove.unit().time().equals(time)) {
          prev = toRemove;
          toRemove = toRemove.next();
        }
        if (toRemove != null) {
          if (prev == null) {
            head = toRemove.next();
          } else {
            prev.next(toRemove.next());
          }
          length--;
          return true;
        }
        return false;
      }
    
      Unit[] toArray() {
        Unit[] units = new Unit[length];
        UnitNode curr = head;
        for (int i = 0; i < length; i++) {
          units[i] = curr.unit();
          curr = curr.next();
        }
        return units;
      }
    
      Unit[] unitsNamed(String name) {
        UnitList list = new UnitList();
        UnitNode curr = head;
        while (curr != null) {
          if (curr.unit().name().equals(name)) {
            list.add(curr.unit());
          }
          curr = curr.next();
        }
        return list.toArray();
      }
    
      Unit unitAfter(Time time) {
        UnitNode curr = head;
        while (curr != null && curr.unit().time().compareTo(time) < 0) {
          curr = curr.next();
        }
        if (curr != null) {
          return curr.unit();
        } else {
          return null;
        }
      }
    
      boolean containsOverlapping(Time time, int duration) {
        Unit after = unitAfter(time);
        if(after != null) {
          return after.time().compareTo(DateTimeUtil.timeAfter(time, duration)) < 0;
        } else {
          return false;
        }
      }
    
    }
  
    class UnitNode {
  
      private final Unit unit;
      private UnitNode next;
    
      UnitNode(Unit unit, UnitNode next) {
        this.unit = unit;
        this.next = next;
      }
    
      UnitNode(Unit unit) {
        this(unit, null);
      }
    
      UnitNode next() {
        return next;
      }
    
      void next(UnitNode next) {
        this.next = next;
      }
    
      Unit unit() {
        return unit;
      }
    }
    
    
   enum Weekday {
      MONDAY(1),
      TUESDAY(2),
      WEDNESDAY(3),
      THURSDAY(4),
      FRIDAY(5),
      SATURDAY(6),
      SUNDAY(7);
    
      public static Weekday getWeekday(int nr) {
        return switch (nr) {
          case 1 -> MONDAY;
          case 2 -> TUESDAY;
          case 3 -> WEDNESDAY;
          case 4 -> THURSDAY;
          case 5 -> FRIDAY;
          case 6 -> SATURDAY;
          case 7 -> SUNDAY;
          default -> SUNDAY;
        };
      }
    
      public final int nr;
    
      Weekday(int nr) {
        this.nr = nr;
      }
    
    }
    