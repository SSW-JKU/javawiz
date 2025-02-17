package hello;

import output.Printer;

public class HelloWorld {
  public static void main(String[] args) {
    System.out.println("Hello, World!");
    Printer.print("Hello, Printer!");
    In.open("Input.txt");
    Out.println(In.readLine());
  }
}