import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  Student, Course, Class, LessonRecord, Teacher,
  Competition, LeaveRecord, CreditTransaction, Assessment
} from '../types';
import { getInitialAppStateSync } from '../services/bootstrap';
import { studentService } from '../services/studentService';
import { courseService } from '../services/courseService';
import { teacherService } from '../services/teacherService';
import toast from 'react-hot-toast';

const initialState = getInitialAppStateSync();

type AppContextType = {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  refreshStudents: () => Promise<void>;
  addStudent: (student: Omit<Student, 'id'>) => Promise<void>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;

  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  refreshCourses: () => Promise<void>;
  addCourse: (course: Omit<Course, 'id'>) => Promise<void>;
  updateCourse: (id: string, data: Partial<Course>) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;

  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  refreshClasses: () => Promise<void>;
  addClass: (cls: Omit<Class, 'id'>) => Promise<void>;
  updateClass: (id: string, data: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;

  teachers: Teacher[];
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  refreshTeachers: () => Promise<void>;
  addTeacher: (teacher: Omit<Teacher, 'id'>) => Promise<void>;
  updateTeacher: (id: string, data: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;

  lessonRecords: LessonRecord[];
  setLessonRecords: React.Dispatch<React.SetStateAction<LessonRecord[]>>;
  addLessonRecord: (record: Omit<LessonRecord, 'id'>) => void;
  updateLessonRecord: (id: string, data: Partial<LessonRecord>) => void;

  leaveRecords: LeaveRecord[];
  setLeaveRecords: React.Dispatch<React.SetStateAction<LeaveRecord[]>>;
  addLeaveRecord: (record: Omit<LeaveRecord, 'id'>) => void;
  updateLeaveRecord: (id: string, data: Partial<LeaveRecord>) => void;

  assessments: Assessment[];
  setAssessments: React.Dispatch<React.SetStateAction<Assessment[]>>;

  competitions: Competition[];
  setCompetitions: React.Dispatch<React.SetStateAction<Competition[]>>;

  orders: CreditTransaction[];
  setOrders: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  addOrder: (order: Omit<CreditTransaction, 'id'>) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>(initialState.students);
  const [courses, setCourses] = useState<Course[]>(initialState.courses);
  const [classes, setClasses] = useState<Class[]>(initialState.classes);
  const [teachers, setTeachers] = useState<Teacher[]>(initialState.teachers);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>(initialState.lessonRecords);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(initialState.leaveRecords);
  const [assessments, setAssessments] = useState<Assessment[]>(initialState.assessments);
  const [competitions, setCompetitions] = useState<Competition[]>(initialState.competitions);
  const [orders, setOrders] = useState<CreditTransaction[]>(initialState.orders);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const message = event instanceof CustomEvent ? event.detail?.message : null;
      toast.error(message || '后端接口请求失败，已使用本地 mock 数据');
    };

    window.addEventListener('api-error', handleApiError);
    return () => window.removeEventListener('api-error', handleApiError);
  }, []);

  const refreshStudents = async () => {
    const latestStudents = await studentService.list();
    setStudents(latestStudents);
  };

  const refreshCourses = async () => {
    const latestCourses = await courseService.list();
    setCourses(latestCourses);
  };

  const refreshClasses = async () => {
    const latestClasses = await courseService.listClasses();
    setClasses(latestClasses);
  };

  const refreshTeachers = async () => {
    const latestTeachers = await teacherService.list();
    setTeachers(latestTeachers);
  };

  useEffect(() => {
    refreshStudents().catch(() => {
      toast.error('学员列表加载失败，已保留本地 mock 数据');
    });
    refreshCourses().catch(() => {
      toast.error('课程列表加载失败，已保留本地 mock 数据');
    });
    refreshClasses().catch(() => {
      toast.error('班级列表加载失败，已保留本地 mock 数据');
    });
    refreshTeachers().catch(() => {
      toast.error('老师列表加载失败，已保留本地 mock 数据');
    });
  }, []);

  const addStudent = async (studentData: Omit<Student, 'id'>) => {
    await studentService.createStudent(studentData);
    await refreshStudents();
  };

  const updateStudent = async (id: string, data: Partial<Student>) => {
    await studentService.updateStudent(id, data);
    await refreshStudents();
  };

  const deleteStudent = async (id: string) => {
    await studentService.deleteStudent(id);
    await refreshStudents();
  };

  const addCourse = async (courseData: Omit<Course, 'id'>) => {
    await courseService.createCourse(courseData);
    await refreshCourses();
  };

  const updateCourse = async (id: string, data: Partial<Course>) => {
    await courseService.updateCourse(id, data);
    await refreshCourses();
  };

  const deleteCourse = async (id: string) => {
    await courseService.deleteCourse(id);
    await refreshCourses();
  };

  const addClass = async (clsData: Omit<Class, 'id'>) => {
    await courseService.createClass(clsData);
    await refreshClasses();
  };

  const updateClass = async (id: string, data: Partial<Class>) => {
    await courseService.updateClass(id, data);
    await refreshClasses();
  };

  const deleteClass = async (id: string) => {
    await courseService.deleteClass(id);
    await refreshClasses();
  };

  const addTeacher = async (teacherData: Omit<Teacher, 'id'>) => {
    await teacherService.createTeacher(teacherData);
    await refreshTeachers();
  };

  const updateTeacher = async (id: string, data: Partial<Teacher>) => {
    await teacherService.updateTeacher(id, data);
    await refreshTeachers();
  };

  const deleteTeacher = async (id: string) => {
    await teacherService.deleteTeacher(id);
    await refreshTeachers();
  };

  const addLessonRecord = (recordData: Omit<LessonRecord, 'id'>) => {
    const newRecord = { ...recordData, id: `R${Math.random().toString(36).substr(2, 9)}` };
    setLessonRecords((prev) => [newRecord, ...prev]);
  };

  const updateLessonRecord = (id: string, data: Partial<LessonRecord>) => {
    setLessonRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
  };

  const addLeaveRecord = (recordData: Omit<LeaveRecord, 'id'>) => {
    const newRecord = { ...recordData, id: `L${Math.random().toString(36).substr(2, 9)}` };
    setLeaveRecords((prev) => [newRecord, ...prev]);
  };

  const updateLeaveRecord = (id: string, data: Partial<LeaveRecord>) => {
    setLeaveRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
  };

  const addOrder = (orderData: Omit<CreditTransaction, 'id'>) => {
    const newOrder = { ...orderData, id: `O${Math.random().toString(36).substr(2, 9)}` };
    setOrders((prev) => [newOrder, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      students, setStudents, refreshStudents, addStudent, updateStudent, deleteStudent,
      courses, setCourses, refreshCourses, addCourse, updateCourse, deleteCourse,
      classes, setClasses, refreshClasses, addClass, updateClass, deleteClass,
      teachers, setTeachers, refreshTeachers, addTeacher, updateTeacher, deleteTeacher,
      lessonRecords, setLessonRecords, addLessonRecord, updateLessonRecord,
      leaveRecords, setLeaveRecords, addLeaveRecord, updateLeaveRecord,
      assessments, setAssessments,
      competitions, setCompetitions,
      orders, setOrders, addOrder,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
