import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

record Person(String firstName, String lastName) {
}

public class ProblemDemo {
  public static void main(String[] args) {
    Person b = new Person(In.readLine(), "Becker");
    List<Person> persons = List.of(b);
  }
}
