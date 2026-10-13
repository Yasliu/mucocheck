"use client";

import React, { useState, useEffect } from "react";
import {
  Users2,
  Plus,
  BookOpen,
  Edit2,
  Trash2,
  History,
  GraduationCap,
  X,
  Check,
  Search,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { ClassGroup, Student, Assessment, StudentScript } from "@/lib/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");

  // Modals
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [classNameInput, setClassNameInput] = useState("");
  const [gradeLevelInput, setGradeLevelInput] = useState("Grade 10");
  const [sectionInput, setSectionInput] = useState("A");
  const [academicYearInput, setAcademicYearInput] = useState("2026-2027");

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentRollInput, setStudentRollInput] = useState("");
  const [studentNameInput, setStudentNameInput] = useState("");
  const [studentEmailInput, setStudentEmailInput] = useState("");

  // Student History Drawer
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [studentHistoryRecords, setStudentHistoryRecords] = useState<
    Array<{
      assessment: Assessment;
      script?: StudentScript;
    }>
  >([]);

  const loadData = () => {
    const clsList = repository.getClasses();
    setClasses(clsList);
    if (clsList.length > 0 && !selectedClassId) {
      setSelectedClassId(clsList[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      setStudents(repository.getStudents(selectedClassId));
    }
  }, [selectedClassId]);

  const handleSaveClass = () => {
    if (!classNameInput.trim()) return;
    if (editingClass) {
      repository.updateClass(editingClass.id, {
        name: classNameInput,
        grade_level: gradeLevelInput,
        section: sectionInput,
        academic_year: academicYearInput,
      });
    } else {
      const created = repository.createClass({
        name: classNameInput,
        grade_level: gradeLevelInput,
        section: sectionInput,
        academic_year: academicYearInput,
      });
      setSelectedClassId(created.id);
    }
    setShowClassModal(false);
    setEditingClass(null);
    loadData();
  };

  const handleSaveStudent = () => {
    if (!studentNameInput.trim() || !studentRollInput.trim() || !selectedClassId) return;
    repository.createStudent({
      class_id: selectedClassId,
      roll_number: studentRollInput,
      full_name: studentNameInput,
      email: studentEmailInput || undefined,
    });
    setShowStudentModal(false);
    setStudentRollInput("");
    setStudentNameInput("");
    setStudentEmailInput("");
    setStudents(repository.getStudents(selectedClassId));
    loadData();
  };

  const handleOpenHistory = (stu: Student) => {
    setHistoryStudent(stu);
    const allAssessments = repository.getAssessments();
    const records = allAssessments.map((asm) => {
      const scr = repository
        .getScripts(asm.id)
        .find((s) => s.student_id === stu.id);
      return { assessment: asm, script: scr };
    });
    setStudentHistoryRecords(records);
  };

  const activeClass = classes.find((c) => c.id === selectedClassId);

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Classes & Students
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Manage student cohorts, enrollments, and track cross-assessment historical performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingClass(null);
              setClassNameInput("");
              setGradeLevelInput("Grade 10");
              setSectionInput("A");
              setAcademicYearInput("2026-2027");
              setShowClassModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#2A5A43]" />
            <span>New Class</span>
          </button>
        </div>
      </div>

      {/* Cohort Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => setSelectedClassId(cls.id)}
            className={`px-3.5 py-2 rounded text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              selectedClassId === cls.id
                ? "bg-[#2A5A43] text-[#FBF9F5]"
                : "bg-[#FFFFFF] text-[#6E685F] border border-[#E8E2D5] hover:bg-[#FAF8F3]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{cls.name}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                selectedClassId === cls.id
                  ? "bg-[#214734] text-[#FBF9F5]"
                  : "bg-[#F6F3EB] text-[#6E685F]"
              }`}
            >
              {cls.student_count || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Class Details & Students Roster */}
      {activeClass && (
        <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-5 space-y-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E8E2D5]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
                  {activeClass.name}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-[#EFF5F1] text-[#2A5A43] font-medium border border-[#BCD4C7]">
                  {activeClass.grade_level} (Sec {activeClass.section})
                </span>
              </div>
              <p className="text-xs text-[#6E685F] mt-0.5">
                Academic Year: {activeClass.academic_year} • {students.length} Enrolled Students
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingClass(activeClass);
                  setClassNameInput(activeClass.name);
                  setGradeLevelInput(activeClass.grade_level);
                  setSectionInput(activeClass.section);
                  setAcademicYearInput(activeClass.academic_year);
                  setShowClassModal(true);
                }}
                className="p-1.5 text-[#6E685F] hover:text-[#1C1A17] rounded border border-[#E8E2D5] hover:bg-[#FAF8F3]"
                title="Edit Class Info"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setStudentRollInput(`BIO-${100 + students.length + 1}`);
                  setStudentNameInput("");
                  setStudentEmailInput("");
                  setShowStudentModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Student</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-[#8E877D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search students in this class..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17] placeholder-[#8E877D] focus:outline-hidden focus:border-[#2A5A43]"
            />
          </div>

          {/* Students Table */}
          <div className="border border-[#E8E2D5] rounded-md overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F3] border-b border-[#E8E2D5] text-[#6E685F] font-medium">
                  <th className="py-2.5 px-3">Roll Number</th>
                  <th className="py-2.5 px-3">Student Full Name</th>
                  <th className="py-2.5 px-3">Email Address</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#8E877D]">
                      No students enrolled in this cohort yet.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu) => (
                    <tr key={stu.id} className="hover:bg-[#FAF8F3] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#1C1A17]">
                        {stu.roll_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#1C1A17]">
                        {stu.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-[#6E685F]">
                        {stu.email || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenHistory(stu)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#2A5A43] hover:bg-[#EFF5F1] rounded border border-[#BCD4C7] transition-colors"
                        >
                          <History className="w-3 h-3" />
                          <span>Assessment History</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 bg-[#1C1A17]/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md max-w-md w-full p-5 space-y-4 shadow-lg border border-[#E8E2D5]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D5]">
              <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
                {editingClass ? "Edit Class" : "Create New Class"}
              </h3>
              <button
                onClick={() => setShowClassModal(false)}
                className="p-1 text-[#8E877D] hover:text-[#1C1A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-[#1C1A17] block mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  value={classNameInput}
                  onChange={(e) => setClassNameInput(e.target.value)}
                  placeholder="e.g. Grade 10 Biology"
                  className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-[#1C1A17] block mb-1">
                    Grade Level
                  </label>
                  <input
                    type="text"
                    value={gradeLevelInput}
                    onChange={(e) => setGradeLevelInput(e.target.value)}
                    placeholder="Grade 10"
                    className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                  />
                </div>
                <div>
                  <label className="font-medium text-[#1C1A17] block mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    value={sectionInput}
                    onChange={(e) => setSectionInput(e.target.value)}
                    placeholder="A"
                    className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#1C1A17] block mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={academicYearInput}
                  onChange={(e) => setAcademicYearInput(e.target.value)}
                  placeholder="2026-2027"
                  className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowClassModal(false)}
                className="px-3 py-1.5 rounded border border-[#E8E2D5] text-xs font-medium text-[#6E685F]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClass}
                className="px-3 py-1.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-xs font-medium text-[#FBF9F5]"
              >
                Save Class
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-[#1C1A17]/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md max-w-md w-full p-5 space-y-4 shadow-lg border border-[#E8E2D5]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D5]">
              <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
                Add Student to {activeClass?.name}
              </h3>
              <button
                onClick={() => setShowStudentModal(false)}
                className="p-1 text-[#8E877D] hover:text-[#1C1A17]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-[#1C1A17] block mb-1">
                  Roll / Student ID *
                </label>
                <input
                  type="text"
                  value={studentRollInput}
                  onChange={(e) => setStudentRollInput(e.target.value)}
                  placeholder="e.g. BIO-106"
                  className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17] font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-[#1C1A17] block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={studentNameInput}
                  onChange={(e) => setStudentNameInput(e.target.value)}
                  placeholder="e.g. Fiona Gallagher"
                  className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                />
              </div>

              <div>
                <label className="font-medium text-[#1C1A17] block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={studentEmailInput}
                  onChange={(e) => setStudentEmailInput(e.target.value)}
                  placeholder="fiona.g@school.edu"
                  className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowStudentModal(false)}
                className="px-3 py-1.5 rounded border border-[#E8E2D5] text-xs font-medium text-[#6E685F]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStudent}
                className="px-3 py-1.5 rounded bg-[#2A5A43] hover:bg-[#214734] text-xs font-medium text-[#FBF9F5]"
              >
                Enroll Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student History Drawer Modal */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 bg-[#1C1A17]/40 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md max-w-xl w-full p-6 space-y-4 shadow-lg border border-[#E8E2D5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D5]">
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#1C1A17]">
                  Assessment History: {historyStudent.full_name}
                </h3>
                <p className="text-xs text-[#6E685F]">
                  Roll ID: {historyStudent.roll_number} • Cohort: {activeClass?.name}
                </p>
              </div>
              <button
                onClick={() => setHistoryStudent(null)}
                className="p-1 text-[#8E877D] hover:text-[#1C1A17]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto text-xs">
              {studentHistoryRecords.length === 0 ? (
                <p className="text-[#8E877D] py-4 text-center">
                  No assessments recorded for this student.
                </p>
              ) : (
                studentHistoryRecords.map(({ assessment, script }) => (
                  <div
                    key={assessment.id}
                    className="p-3.5 rounded border border-[#E8E2D5] bg-[#FAF8F3] flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-[#1C1A17]">
                        {assessment.title}
                      </p>
                      <p className="text-[11px] text-[#6E685F]">
                        {assessment.subject} • Date: {assessment.date}
                      </p>
                    </div>

                    <div className="text-right">
                      {script && script.total_score !== null ? (
                        <div>
                          <span className="font-mono font-bold text-sm text-[#2A5A43]">
                            {script.total_score} / {assessment.max_marks}
                          </span>
                          <span className="text-[11px] text-[#6E685F] block">
                            {script.percentage}% ({script.status})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#C25B3E] italic">
                          Absent / Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E8E2D5]">
              <button
                onClick={() => setHistoryStudent(null)}
                className="px-4 py-2 rounded bg-[#2A5A43] text-xs font-medium text-[#FBF9F5]"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
